use async_trait::async_trait;
use sqlx::mysql::{MySqlPoolOptions, MySqlConnectOptions, MySqlRow, MySqlPool};
use sqlx::{Row, Column, TypeInfo, ValueRef};
use std::time::Duration;

use crate::adapter::{DatabaseAdapter, ConnectionConfig, ConnectionType};
use crate::types::{QueryResult, TablePreview};
use crate::schema::{Schema, Table, Column as SchemaColumn, ForeignKey};
use crate::sql_utils::{get_sql_type, is_safe_for_mvp, has_limit_clause, validate_sql_structure, get_last_statement, SqlType};

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
            .map_err(|e| format!("MySQL Connection failed: {}", e))?;
            
        // Health check
        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(|e| {
                if e.to_string().contains("Access denied") {
                    "Authentication failed: Check your username and password".to_string()
                } else if e.to_string().contains("Unknown database") {
                    "Database does not exist".to_string()
                } else if e.to_string().contains("Connection refused") {
                    "Connection refused: Check host and port".to_string()
                } else {
                    format!("MySQL Connection failed: {}", e)
                }
            })?;
            
        self.pool = Some(pool);
        Ok(())
    }

    async fn list_databases(&self) -> Result<Vec<String>, String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;
        
        let rows = sqlx::query("SHOW DATABASES")
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to list databases: {}", e))?;

        let databases: Vec<String> = rows.iter()
            .map(|row| row.get(0))
            .collect();

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
            return Err("Destructive queries (UPDATE, DELETE, DROP, etc.) are disabled in this version.".into());
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
        if let Err(e) = validate_sql_structure(&normalized_sql, &sql_type) {
            return Err(e);
        }

        let mut final_sql = normalized_sql.clone();
        let mut was_limited = false;

        if sql_type == SqlType::Select {
            if !has_limit_clause(&normalized_sql) {
                final_sql.push_str(" LIMIT 1000");
                was_limited = true;
            }
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

        let tables: Vec<String> = rows.iter()
            .map(|row| row.get(0))
            .collect();

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
                    key_type: if key_type.is_empty() { None } else { Some(key_type) },
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
}

// Helper to map rows to TablePreview (copied from lib.rs and adapted)
fn map_rows_to_preview(rows: Vec<MySqlRow>, limited: bool) -> Result<TablePreview, String> {
    if rows.is_empty() {
        return Ok(TablePreview { columns: vec![], rows: vec![], limited: false, formatted_output: None });
    }

    let columns: Vec<String> = rows[0]
        .columns()
        .iter()
        .map(|c| c.name().to_string())
        .collect();

    let mut refined_data_rows = Vec::new();
    for row in rows {
        let mut row_vals = Vec::new();
        for col in row.columns() {
            let col_name = col.name();
            // Attempt to handle common types
            let val = if let Ok(v) = row.try_get::<String, _>(col_name) {
                v
            } else if let Ok(v) = row.try_get::<i64, _>(col_name) {
                v.to_string()
            } else if let Ok(v) = row.try_get::<f64, _>(col_name) {
                v.to_string()
            } else if let Ok(v) = row.try_get::<bool, _>(col_name) {
                if v { "1".to_string() } else { "0".to_string() }
            } else if let Ok(v) = row.try_get::<i32, _>(col_name) {
                 v.to_string()
            } else if let Ok(v) = row.try_get::<f32, _>(col_name) {
                 v.to_string()
            } else if let Ok(_) = row.try_get::<Vec<u8>, _>(col_name) {
                 "<binary>".to_string()
            } else {
                 if row.try_get_raw(col_name).map(|r| r.is_null()).unwrap_or(false) {
                     "NULL".to_string()
                 } else {
                     let type_info = col.type_info();
                     format!("<{}>", type_info.name())
                 }
            };
            row_vals.push(val);
        }
        refined_data_rows.push(row_vals);
    }

    Ok(TablePreview {
        columns,
        rows: refined_data_rows,
        limited,
        formatted_output: None,
    })
}
