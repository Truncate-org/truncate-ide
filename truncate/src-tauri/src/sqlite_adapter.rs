use crate::adapter::{ConnectionConfig, ConnectionType, DatabaseAdapter};
use crate::schema::{Column as SchemaColumn, ForeignKey, Schema, Table};
use crate::sql_utils::{
    get_last_statement, get_sql_type, has_limit_clause, is_safe_for_mvp, SqlType,
};
use crate::types::{QueryResult, TablePreview};
use async_trait::async_trait;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions, SqliteRow};
use sqlx::{Column, Row, TypeInfo, ValueRef};
use std::path::Path;
use std::str::FromStr;
use std::time::Duration;

pub struct SqliteAdapter {
    pub(crate) pool: Option<SqlitePool>,
    pub(crate) file_path: String,
    conn_config: ConnectionConfig,
    max_connections: u32,
    acquire_timeout: Duration,
}

impl SqliteAdapter {
    pub fn new(file_path: &str) -> Self {
        Self {
            pool: None,
            file_path: file_path.to_string(),
            conn_config: ConnectionConfig {
                host: "localhost".to_string(), // Dummy for SQLite
                port: 0,
                user: "".to_string(),
                pass: "".to_string(),
                db_type: ConnectionType::SQLite,
                current_database: Some(file_path.to_string()),
            },
            max_connections: 1, // SQLite usually prefers single writer, but WAL allows readers. keep low for safety.
            acquire_timeout: Duration::from_secs(5),
        }
    }
}

#[async_trait]
impl DatabaseAdapter for SqliteAdapter {
    async fn connect(&mut self) -> Result<(), String> {
        if self.file_path.is_empty() {
            return Err("No SQLite database file specified.".to_string());
        }

        let path = Path::new(&self.file_path);
        if !path.exists() {
            return Err(format!(
                "The specified SQLite file does not exist: {}. Please check the file path.",
                self.file_path
            ));
        }

        if path.is_dir() {
            return Err(format!(
                "The specified path is a directory, not a file: {}.",
                self.file_path
            ));
        }

        let options = SqliteConnectOptions::from_str(&format!("sqlite://{}", self.file_path))
            .map_err(|e| format!("Invalid SQLite connection string: {}", e))?
            .create_if_missing(false);

        let pool = SqlitePoolOptions::new()
            .max_connections(self.max_connections)
            .acquire_timeout(self.acquire_timeout)
            .connect_with(options)
            .await
            .map_err(|e| format!("SQLite Connection failed: {}", e))?;

        // Health check
        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(|e| format!("SQLite health check failed: {}", e))?;

        self.pool = Some(pool);
        Ok(())
    }

    async fn list_databases(&self) -> Result<Vec<String>, String> {
        // SQLite doesn't really have "databases" in the server sense.
        // We return the file name as the single available DB.
        Ok(vec![self.file_path.clone()])
    }

    async fn switch_database(&mut self, _db_name: &str) -> Result<bool, String> {
        // For SQLite, "switching" means connecting to a different file,
        // which usually implies a new connection config.
        // But if the user selected a different file in the UI, `connect_server` would be called again.
        // If this is called, it might be a no-op if db_name == file_path.
        Ok(true)
    }

    async fn get_current_database(&self) -> Result<String, String> {
        Ok(self.file_path.clone())
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

        // Normalize SQL
        let mut normalized_sql = sql_to_run.trim().to_string();
        if normalized_sql.ends_with(';') {
            normalized_sql.pop();
        }

        let mut final_sql = normalized_sql.clone();
        let mut was_limited = false;

        if sql_type == SqlType::Select && !has_limit_clause(&normalized_sql) {
            final_sql.push_str(" LIMIT 1000");
            was_limited = true;
        }

        let rows: Vec<SqliteRow> = sqlx::query(&final_sql)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Query failed: {}", e))?;

        let preview = map_rows_to_preview(rows, was_limited)?;
        Ok(QueryResult::ResultSet(preview))
    }

    async fn preview_table(&self, table_name: &str) -> Result<TablePreview, String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;

        if !table_name
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
        {
            // SQLite table names can be flexible but let's be safe
            // actually, might need quoting if we support weird names.
            // For now, simple validation.
            //  return Err("Invalid table name".to_string());
        }

        let query = format!("SELECT * FROM \"{}\" LIMIT 50", table_name);
        let rows: Vec<SqliteRow> = sqlx::query(&query)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to preview table: {}", e))?;

        map_rows_to_preview(rows, true)
    }

    async fn list_tables(&self) -> Result<Vec<String>, String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;

        let query =
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
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

    async fn extract_schema(&self, _db_name: &str) -> Result<Schema, String> {
        let pool = self.pool.as_ref().ok_or("No database connection active")?;

        // 1. Get Tables
        let tables_query =
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
        let table_rows = sqlx::query(tables_query)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to fetch tables: {}", e))?;

        let mut tables = Vec::new();

        for row in table_rows {
            let table_name: String = row
                .try_get(0)
                .map_err(|e| format!("Failed to get table name: {}", e))?;

            // 2. Get Columns (PRAGMA table_info)
            let columns_query = format!("PRAGMA table_info(\"{}\")", table_name);
            let col_rows = sqlx::query(&columns_query)
                .fetch_all(pool)
                .await
                .map_err(|e| format!("Failed to fetch columns for {}: {}", table_name, e))?;

            let mut columns = Vec::new();
            let mut primary_keys = Vec::new();

            for col_row in col_rows {
                // PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
                let name: String = col_row.try_get(1).unwrap_or_else(|_| "unknown".to_string());
                let data_type: String = col_row.try_get(2).unwrap_or_else(|_| "TEXT".to_string());
                let notnull: i32 = col_row.try_get(3).unwrap_or(0);
                let pk: i32 = col_row.try_get(5).unwrap_or(0);

                if pk > 0 {
                    primary_keys.push(name.clone());
                }

                columns.push(SchemaColumn {
                    name,
                    data_type,
                    is_nullable: notnull == 0,
                    key_type: if pk > 0 {
                        Some("PRI".to_string())
                    } else {
                        None
                    }, // simplistic
                });
            }

            // 3. Get Foreign Keys (PRAGMA foreign_key_list)
            let fk_query = format!("PRAGMA foreign_key_list(\"{}\")", table_name);
            let fk_rows = sqlx::query(&fk_query)
                .fetch_all(pool)
                .await
                .map_err(|e| format!("Failed to fetch FKs for {}: {}", table_name, e))?;

            let mut foreign_keys = Vec::new();
            for fk_row in fk_rows {
                // id, seq, table, from, to, on_update, on_delete, match
                let ref_table: String = fk_row.try_get(2).unwrap_or_default();
                let from_col: String = fk_row.try_get(3).unwrap_or_default();
                let to_col: String = fk_row
                    .try_get::<Option<String>, _>(4)
                    .unwrap_or_default()
                    .unwrap_or_default();

                foreign_keys.push(ForeignKey {
                    column_name: from_col,
                    ref_table,
                    ref_column: to_col,
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
            database_name: "sqlite".to_string(), // or filename
            tables,
        })
    }

    async fn drop_database(&mut self, _db_name: &str) -> Result<(), String> {
        Err("Drop database is not supported for SQLite".to_string())
    }
}

// Helper to map rows to TablePreview
fn map_rows_to_preview(rows: Vec<SqliteRow>, limited: bool) -> Result<TablePreview, String> {
    if rows.is_empty() {
        return Ok(TablePreview {
            columns: vec![],
            rows: vec![],
            limited,
            formatted_output: None,
        });
    }

    // SQLite columns in rows have type info, but it might be dynamic per row.
    // However, column definitions are usually static.
    let first_row = &rows[0];
    let columns: Vec<crate::types::ColumnDefinition> = first_row
        .columns()
        .iter()
        .map(|c| {
            let type_info = c.type_info();
            crate::types::ColumnDefinition {
                name: c.name().to_string(),
                type_name: type_info.name().to_string(), // e.g. "TEXT", "INTEGER"
            }
        })
        .collect();

    let mut data = Vec::new();

    for row in rows {
        let mut row_data = Vec::new();
        for (i, _) in columns.iter().enumerate() {
            if row.try_get_raw(i).map(|v| v.is_null()).unwrap_or(true) {
                row_data.push("NULL".to_string());
                continue;
            }

            let val_str = if let Ok(val) = row.try_get::<String, _>(i) {
                val
            } else if let Ok(val) = row.try_get::<i64, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<f64, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<bool, _>(i) {
                val.to_string()
            } else if let Ok(val) = row.try_get::<Vec<u8>, _>(i) {
                format!("Binary ({} bytes)", val.len())
            } else {
                "UNSUPPORTED".to_string()
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
