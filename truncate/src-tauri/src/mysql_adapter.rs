use async_trait::async_trait;
use sqlx::mysql::{MySqlConnectOptions, MySqlPool, MySqlPoolOptions, MySqlRow};
use sqlx::{Column, Row, TypeInfo, ValueRef};
use std::time::Duration;

use crate::adapter::{ConnectionConfig, ConnectionType, DatabaseAdapter};
use crate::schema::{Column as SchemaColumn, ForeignKey, Schema, Table};
use crate::sql_utils::{
    get_last_statement, get_sql_type, has_limit_clause, is_safe_for_mvp, validate_sql_structure,
    SqlType,
};
use crate::types::{QueryResult, TablePreview};

pub struct MySqlAdapter {
    pool: Option<MySqlPool>,
    config: MySqlConnectOptions,
    // Store raw credentials for reconstruction if needed, or extract from options?
    // ConnectOptions doesn't easily expose password. Let's store ConnectionConfig.
    conn_config: ConnectionConfig,
    max_connections: u32,
    acquire_timeout: Duration,
}

impl MySqlAdapter {
    pub fn new(host: &str, port: u16, user: &str, pass: &str) -> Self {
        let config = MySqlConnectOptions::new()
            .host(host)
            .port(port)
            .username(user)
            .password(pass);

        Self {
            pool: None,
            config,
            conn_config: ConnectionConfig {
                host: host.to_string(),
                port,
                user: user.to_string(),
                pass: pass.to_string(),
                db_type: ConnectionType::MySQL,
                current_database: None,
            },
            max_connections: 5,
            acquire_timeout: Duration::from_secs(5),
        }
    }
}

#[async_trait]
impl DatabaseAdapter for MySqlAdapter {
    async fn connect(&mut self) -> Result<(), String> {
        let pool = MySqlPoolOptions::new()
            .max_connections(self.max_connections)
            .acquire_timeout(self.acquire_timeout)
            .connect_with(self.config.clone())
            .await
            .map_err(|e| {
                let err_msg = e.to_string();
                if err_msg.contains("Access denied") {
                    "Authentication failed: Invalid username or password.".to_string()
                } else if err_msg.contains("Unknown database") {
                    "The specified database does not exist.".to_string()
                } else if err_msg.contains("Connection refused") || err_msg.contains("Network is unreachable") {
                    "Connection refused: Ensure the database server is running and accessible at the specified host and port.".to_string()
                } else {
                    format!("MySQL Connection Error: {}", e)
                }
            })?;

        // Health check
        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(|e| format!("MySQL health check failed: {}", e))?;

        self.pool = Some(pool);
        Ok(())
    }

    async fn list_databases(&self) -> Result<Vec<String>, String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;

        let rows = sqlx::query("SHOW DATABASES")
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to list databases: {}", e))?;

        let databases: Vec<String> = rows.iter().map(|row| row.get(0)).collect();

        Ok(databases)
    }

    async fn switch_database(&mut self, db_name: &str) -> Result<bool, String> {
        let new_config = self.config.clone().database(db_name);

        let pool = MySqlPoolOptions::new()
            .max_connections(self.max_connections)
            .acquire_timeout(self.acquire_timeout)
            .connect_with(new_config.clone())
            .await
            .map_err(|e| format!("Failed to connect to database {}: {}", db_name, e))?;

        // Re-verify connection
        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to verify connection to {}: {}", db_name, e))?;

        self.pool = Some(pool);
        self.config = new_config;
        self.conn_config.current_database = Some(db_name.to_string());

        Ok(true) // Reconnected
    }

    async fn get_current_database(&self) -> Result<String, String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;
        let row: (String,) = sqlx::query_as("SELECT DATABASE()")
            .fetch_one(pool)
            .await
            .map_err(|e| format!("Failed to get current database: {}", e))?;
        Ok(row.0)
    }

    async fn execute_query(&self, sql: &str) -> Result<QueryResult, String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;

        // 0. Extract Last Statement
        let sql_to_run = match get_last_statement(sql) {
            Some(s) => s,
            None => return Err("No query to execute".to_string()),
        };

        let sql_type = get_sql_type(&sql_to_run);

        // 1. Safety Check
        if !is_safe_for_mvp(&sql_type) {
            return Err(
                "Destructive queries (UPDATE, DELETE, DROP, etc.) are disabled in this version."
                    .into(),
            );
        }

        // 2. Handle USE command (if passed directly as query)
        // Note: In adapter pattern, we might want to handle this at a higher level or return a specific result indicating a switch?
        // For now, let's treat USE as a special case that returns Success message but doesn't actually switch the pool here
        // because `switch_database` is mut.
        // If the user types "USE db", we should probably block it or suggest using the UI.
        // OR we can implement it if we had interior mutability or passed self as mut?
        // Since `execute_query` takes `&self`, we cannot modify the pool. So we should block USE commands or handle them via UI.
        if sql_type == SqlType::Use {
            return Err("Please use the database selector to switch databases.".into());
        }

        // Normalize SQL
        let mut normalized_sql = sql_to_run.trim().to_string();
        if normalized_sql.ends_with(';') {
            normalized_sql.pop();
        }

        // Validate SQL Structure
        validate_sql_structure(&normalized_sql, &sql_type)?;

        let mut final_sql = normalized_sql.clone();
        let mut was_limited = false;

        if sql_type == SqlType::Select && !has_limit_clause(&normalized_sql) {
            final_sql.push_str(" LIMIT 1000");
            was_limited = true;
        }

        let rows: Vec<MySqlRow> = sqlx::query(&final_sql)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Query failed: {}", e))?;

        let preview = map_rows_to_preview(rows, was_limited)?;
        Ok(QueryResult::ResultSet(preview))
    }

    async fn preview_table(&self, table_name: &str) -> Result<TablePreview, String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;

        if !table_name.chars().all(|c| c.is_alphanumeric() || c == '_') {
            return Err("Invalid table name".to_string());
        }

        let query = format!("SELECT * FROM {} LIMIT 50", table_name);
        let rows: Vec<MySqlRow> = sqlx::query(&query)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to preview table: {}", e))?;

        map_rows_to_preview(rows, true)
    }

    async fn list_tables(&self) -> Result<Vec<String>, String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;

        let rows = sqlx::query("SHOW TABLES")
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to list tables: {}", e))?;

        let tables: Vec<String> = rows.iter().map(|row| row.get(0)).collect();

        Ok(tables)
    }

    async fn disconnect(&mut self) -> Result<(), String> {
        if let Some(pool) = self.pool.take() {
            pool.close().await;
        }
        Ok(())
    }

    fn get_connection_config(&self) -> ConnectionConfig {
        self.conn_config.clone()
    }

    async fn extract_schema(&self, db_name: &str) -> Result<Schema, String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;

        // Helper
        fn get_string_from_row(row: &MySqlRow, column: &str) -> String {
            use sqlx::Row;
            if let Ok(s) = row.try_get::<String, _>(column) {
                return s;
            }
            if let Ok(bytes) = row.try_get::<Vec<u8>, _>(column) {
                return String::from_utf8_lossy(&bytes).to_string();
            }
            String::new()
        }

        // 1. Get Tables
        let tables_query = "
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
        ";
        let rows = sqlx::query(tables_query)
            .bind(db_name)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to fetch tables: {}", e))?;

        let mut tables = Vec::new();

        for row in rows {
            let table_name = get_string_from_row(&row, "TABLE_NAME");

            // 2. Get Columns
            let columns_query = "
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
            ";
            let col_rows = sqlx::query(columns_query)
                .bind(db_name)
                .bind(&table_name)
                .fetch_all(pool)
                .await
                .map_err(|e| format!("Failed to fetch columns for {}: {}", table_name, e))?;

            let mut columns = Vec::new();
            let mut primary_keys = Vec::new();

            for col_row in col_rows {
                let name = get_string_from_row(&col_row, "COLUMN_NAME");
                let data_type = get_string_from_row(&col_row, "DATA_TYPE");
                let is_nullable_str = get_string_from_row(&col_row, "IS_NULLABLE");
                let key_type = get_string_from_row(&col_row, "COLUMN_KEY");

                if key_type == "PRI" {
                    primary_keys.push(name.clone());
                }

                columns.push(SchemaColumn {
                    name,
                    data_type,
                    is_nullable: is_nullable_str == "YES",
                    key_type: if key_type.is_empty() {
                        None
                    } else {
                        Some(key_type)
                    },
                });
            }

            // 3. Get Foreign Keys
            let fk_query = "
            SELECT 
                COLUMN_NAME, 
                REFERENCED_TABLE_NAME, 
                REFERENCED_COLUMN_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE 
                TABLE_SCHEMA = ? 
                AND TABLE_NAME = ? 
                AND REFERENCED_TABLE_NAME IS NOT NULL
        ";
            let fk_rows = sqlx::query(fk_query)
                .bind(db_name)
                .bind(&table_name)
                .fetch_all(pool)
                .await
                .map_err(|e| format!("Failed to fetch foreign keys for {}: {}", table_name, e))?;

            let mut foreign_keys = Vec::new();
            for fk_row in fk_rows {
                foreign_keys.push(ForeignKey {
                    column_name: get_string_from_row(&fk_row, "COLUMN_NAME"),
                    ref_table: get_string_from_row(&fk_row, "REFERENCED_TABLE_NAME"),
                    ref_column: get_string_from_row(&fk_row, "REFERENCED_COLUMN_NAME"),
                });
            }

            tables.push(Table {
                name: table_name,
                columns,
                foreign_keys,
                primary_keys,
            });
        }

        Ok(Schema {
            database_name: db_name.to_string(),
            tables,
        })
    }

    async fn drop_database(&mut self, db_name: &str) -> Result<(), String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;
        let query = format!("DROP DATABASE `{}`", db_name);
        sqlx::query(&query)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to drop database: {}", e))?;
        Ok(())
    }
}

// Helper to map rows to TablePreview (copied from lib.rs and adapted)
fn map_rows_to_preview(rows: Vec<MySqlRow>, limited: bool) -> Result<TablePreview, String> {
    if rows.is_empty() {
        return Ok(TablePreview {
            columns: vec![], // indeterminate columns if no rows?
            // Ideally we get columns from statement execution even if empty,
            // but sqlx fetch_all returns rows.
            // Only way to get cols without rows is explicit Describe or from a row.
            // For now empty is empty.
            rows: vec![],
            limited,
            formatted_output: None,
        });
    }

    // Capture columns from the first row
    let first_row = &rows[0];
    let columns: Vec<crate::types::ColumnDefinition> = first_row
        .columns()
        .iter()
        .map(|c| {
            let type_info = c.type_info();
            crate::types::ColumnDefinition {
                name: c.name().to_string(),
                type_name: type_info.name().to_string(), // e.g. "VARCHAR", "INT", etc.
            }
        })
        .collect();

    let mut data = Vec::new();

    for row in rows {
        let mut row_data = Vec::new();
        for (i, _) in columns.iter().enumerate() {
            // Using try_get_unchecked or generic try_get with index
            // We need to match based on type name to format correctly.
            // SQLx ValueRef might be better but let's try strict decoding based on type name

            let val_str = if let Ok(val) = row.try_get::<String, _>(i) {
                val // It's a string, easy
            } else if let Ok(val) = row.try_get::<i64, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<u64, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<f64, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<bool, _>(i) {
                val.to_string() // "true" / "false"
            } else if let Ok(val) = row.try_get::<rust_decimal::Decimal, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<chrono::NaiveDateTime, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<chrono::NaiveDate, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<chrono::NaiveTime, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<Vec<u8>, _>(i) {
                format!("Binary ({} bytes)", val.len())
            } else {
                // If everything fails, it might be NULL or unknown
                if row.try_get_raw(i).map(|v| v.is_null()).unwrap_or(false) {
                    "NULL".to_string()
                } else {
                    // Fallback string lossy?
                    // Attempt to debug format if possible or just <UNKNOWN>
                    // Actually, try_get::<String> usually handles many types if sqlx converts them.
                    // If it failed above, it's tricky.
                    // Attempt JSON value?
                    "NULL".to_string() // keeping safe for now, checking raw nullity above
                }
            };

            // Double check nullity explicitly because try_get might fail on type mismatch rather than null
            let final_val = if row.try_get_raw(i).map(|v| v.is_null()).unwrap_or(true) {
                "NULL".to_string()
            } else {
                val_str
            };

            row_data.push(final_val);
        }
        data.push(row_data);
    }

    Ok(TablePreview {
        columns,
        rows: data,
        limited,
        formatted_output: None,
    })
}
