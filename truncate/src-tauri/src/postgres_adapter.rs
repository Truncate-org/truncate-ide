use async_trait::async_trait;
use sqlx::postgres::{PgConnectOptions, PgPool, PgPoolOptions, PgRow};
use sqlx::{Column, Row, TypeInfo, ValueRef};
use std::time::Duration;

use crate::adapter::{ConnectionConfig, ConnectionType, DatabaseAdapter};
use crate::sql_utils::{
    get_last_statement, get_sql_type, has_limit_clause, is_safe_for_mvp, validate_sql_structure,
    SqlType,
};
use crate::types::{QueryResult, TablePreview};

pub struct PostgresAdapter {
    pool: Option<PgPool>,
    config: PgConnectOptions,
    conn_config: ConnectionConfig,
    max_connections: u32,
    acquire_timeout: Duration,
}

impl PostgresAdapter {
    pub fn new(host: &str, port: u16, user: &str, pass: &str) -> Self {
        let config = PgConnectOptions::new()
            .host(host)
            .port(port)
            .username(user)
            .password(pass)
            .database("postgres"); // Default to 'postgres' db for initial connection

        Self {
            pool: None,
            config,
            conn_config: ConnectionConfig {
                host: host.to_string(),
                port,
                user: user.to_string(),
                pass: pass.to_string(),
                db_type: ConnectionType::PostgreSQL,
                current_database: Some("postgres".to_string()),
            },
            max_connections: 5,
            acquire_timeout: Duration::from_secs(5),
        }
    }
}

#[async_trait]
impl DatabaseAdapter for PostgresAdapter {
    async fn connect(&mut self) -> Result<(), String> {
        let pool = PgPoolOptions::new()
            .max_connections(self.max_connections)
            .acquire_timeout(self.acquire_timeout)
            .connect_with(self.config.clone())
            .await
            .map_err(|e| {
                let err_msg = e.to_string();
                if err_msg.contains("password authentication failed") {
                    "Authentication failed: Invalid password or username.".to_string()
                } else if err_msg.contains("database") && err_msg.contains("does not exist") {
                    "The specified database does not exist.".to_string()
                } else if err_msg.contains("Connection refused")
                    || err_msg.contains("Network is unreachable")
                {
                    "Connection refused: Ensure the PostgreSQL server is running and accessible."
                        .to_string()
                } else {
                    format!("PostgreSQL Connection Error: {}", e)
                }
            })?;

        // Health check
        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(|e| format!("PostgreSQL health check failed: {}", e))?;

        self.pool = Some(pool);
        Ok(())
    }

    async fn list_databases(&self) -> Result<Vec<String>, String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;

        let rows = sqlx::query("SELECT datname FROM pg_database WHERE datistemplate = false")
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to list databases: {}", e))?;

        let databases: Vec<String> = rows.iter().map(|row| row.get(0)).collect();

        Ok(databases)
    }

    async fn switch_database(&mut self, db_name: &str) -> Result<bool, String> {
        // Postgres requires a new connection to switch databases
        let new_config = self.config.clone().database(db_name);

        let pool = PgPoolOptions::new()
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
        let row: (String,) = sqlx::query_as("SELECT current_database()")
            .fetch_one(pool)
            .await
            .map_err(|e| format!("Failed to get current database: {}", e))?;
        Ok(row.0)
    }

    async fn execute_query(&self, sql: &str) -> Result<QueryResult, String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;

        let sql_to_run = match get_last_statement(sql) {
            Some(s) => s,
            None => return Err("No query to execute".to_string()),
        };

        let sql_type = get_sql_type(&sql_to_run);

        if !is_safe_for_mvp(&sql_type) {
            return Err(
                "Destructive queries (UPDATE, DELETE, DROP, etc.) are disabled in this version."
                    .into(),
            );
        }

        if sql_type == SqlType::Use {
            return Err("Please use the database selector to switch databases.".into());
        }

        let mut normalized_sql = sql_to_run.trim().to_string();
        if normalized_sql.ends_with(';') {
            normalized_sql.pop();
        }

        validate_sql_structure(&normalized_sql, &sql_type)?;

        let mut final_sql = normalized_sql.clone();
        let mut was_limited = false;

        if sql_type == SqlType::Select && !has_limit_clause(&normalized_sql) {
            final_sql.push_str(" LIMIT 1000");
            was_limited = true;
        }

        let rows: Vec<PgRow> = sqlx::query(&final_sql)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Query failed: {}", e))?;

        let preview = map_rows_to_preview(rows, was_limited)?;
        Ok(QueryResult::ResultSet(preview))
    }

    async fn preview_table(&self, table_name: &str) -> Result<TablePreview, String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;

        // Sanity check
        if !table_name
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '.')
        {
            // Postgres tables might have schema prefix? Allow dot?
            // Actually, keeping strict for now.
            if table_name.contains(' ') || table_name.contains(';') {
                return Err("Invalid table name".to_string());
            }
        }

        let query = format!("SELECT * FROM {} LIMIT 50", table_name);
        let rows: Vec<PgRow> = sqlx::query(&query)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to preview table: {}", e))?;

        map_rows_to_preview(rows, true)
    }

    async fn list_tables(&self) -> Result<Vec<String>, String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;

        // Postgres query to list public tables
        let query = "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'";

        let rows = sqlx::query(query)
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

    async fn extract_schema(&self, _db_name: &str) -> Result<crate::schema::Schema, String> {
        Err("Schema export not yet implemented for PostgreSQL".to_string())
    }

    async fn drop_database(&mut self, db_name: &str) -> Result<(), String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;

        // 1. Terminate connections
        let terminate_sql = format!(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{}'",
            db_name
        );

        // We use execute here, likely it returns rows but we ignore them?
        // pg_terminate_backend returns boolean. execute works.
        sqlx::query(&terminate_sql)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to terminate connections: {}", e))?;

        // 2. Drop Database
        let drop_sql = format!("DROP DATABASE \"{}\"", db_name);
        sqlx::query(&drop_sql)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to drop database: {}", e))?;

        Ok(())
    }
}

fn map_rows_to_preview(rows: Vec<PgRow>, limited: bool) -> Result<TablePreview, String> {
    if rows.is_empty() {
        return Ok(TablePreview {
            columns: vec![],
            rows: vec![],
            limited,
            formatted_output: None,
        });
    }

    let first_row = &rows[0];
    let columns: Vec<crate::types::ColumnDefinition> = first_row
        .columns()
        .iter()
        .map(|c| {
            let type_info = c.type_info();
            crate::types::ColumnDefinition {
                name: c.name().to_string(),
                type_name: type_info.name().to_string(), // e.g. "VARCHAR", "INT4", "BOOL"
            }
        })
        .collect();

    let mut data = Vec::new();

    for row in rows {
        let mut row_data = Vec::new();
        for (i, _) in columns.iter().enumerate() {
            // Check NULL first
            if row.try_get_raw(i).map(|v| v.is_null()).unwrap_or(true) {
                row_data.push("NULL".to_string());
                continue;
            }

            // Attempt type-specific extractions
            let val_str = if let Ok(val) = row.try_get::<String, _>(i) {
                val
            } else if let Ok(val) = row.try_get::<i64, _>(i) {
                // Handles INT8
                val.to_string()
            } else if let Ok(val) = row.try_get::<i32, _>(i) {
                // Handles INT4
                val.to_string()
            } else if let Ok(val) = row.try_get::<i16, _>(i) {
                // Handles INT2
                val.to_string()
            } else if let Ok(val) = row.try_get::<f64, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<bool, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<rust_decimal::Decimal, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<uuid::Uuid, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<chrono::NaiveDateTime, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<chrono::NaiveDate, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<serde_json::Value, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<Vec<u8>, _>(i) {
                format!("Binary ({} bytes)", val.len())
            } else {
                // Fallback for unhandled types
                "UNSUPPORTED_TYPE".to_string()
            };

            row_data.push(val_str);
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
