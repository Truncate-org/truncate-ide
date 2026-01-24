use tauri::State;
use sqlx::mysql::{MySqlPoolOptions, MySqlConnectOptions, MySqlRow};
use sqlx::{Row, Column};
use std::time::Duration;
use crate::db_state::{DbState, ConnectionConfig};

pub mod db_state;

#[derive(serde::Serialize)]
pub struct TablePreview {
    columns: Vec<String>,
    rows: Vec<Vec<String>>,
}

#[tauri::command]
async fn mysql_connect_server(
    state: State<'_, DbState>,
    host: String,
    port: u16,
    user: String,
    pass: String,
) -> Result<Vec<String>, String> {
    let options = MySqlConnectOptions::new()
        .host(&host)
        .port(port)
        .username(&user)
        .password(&pass);
    
    let pool = MySqlPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(5))
        .connect_with(options)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    // helper to map checking
    let rows = sqlx::query("SHOW DATABASES")
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to list databases: {}", e))?;

    let databases: Vec<String> = rows.iter()
        .map(|row| row.get(0))
        .collect();

    *state.pool.lock().unwrap() = Some(pool);
    *state.config.lock().unwrap() = Some(ConnectionConfig {
        host,
        port,
        user,
        pass,
    });

    Ok(databases)
}

#[tauri::command]
async fn mysql_select_database(
    state: State<'_, DbState>,
    database_name: String,
) -> Result<(), String> {
    let config = {
        let guard = state.config.lock().unwrap();
        guard.clone().ok_or("No active connection")?
    };

    let options = MySqlConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .username(&config.user)
        .password(&config.pass)
        .database(&database_name);

    let pool = MySqlPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(5))
        .connect_with(options)
        .await
        .map_err(|e| format!("Failed to connect to database {}: {}", database_name, e))?;

    *state.pool.lock().unwrap() = Some(pool);
    Ok(())
}

#[tauri::command]
async fn mysql_list_tables(
    state: State<'_, DbState>,
) -> Result<Vec<String>, String> {
    let pool = {
        let guard = state.pool.lock().unwrap();
        guard.as_ref().ok_or("No database connection active")?.clone()
    };

    let rows = sqlx::query("SHOW TABLES")
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to list tables: {}", e))?;

    let tables: Vec<String> = rows.iter()
        .map(|row| row.get(0))
        .collect();

    Ok(tables)
}

#[tauri::command]
async fn mysql_preview_table(
    state: State<'_, DbState>,
    table_name: String,
) -> Result<TablePreview, String> {
    let pool = {
        let guard = state.pool.lock().unwrap();
        guard.as_ref().ok_or("No database connection active")?.clone()
    };

    if !table_name.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err("Invalid table name".to_string());
    }

    let query = format!("SELECT * FROM {} LIMIT 50", table_name);
    
    // Explicit type annotation for rows
    let rows: Vec<MySqlRow> = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to preview table: {}", e))?;

    if rows.is_empty() {
        return Ok(TablePreview { columns: vec![], rows: vec![] });
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
            // We'll treat everything as string for simplicity or specific types
            // Sqlx requires known types for `try_get`.
            // We can check the type from column info or try multiple.
            
            // To be more robust, we can use `row.try_get_raw` then format, but that's complex.
            // Let's try casting to common types.
            
            let val = if let Ok(v) = row.try_get::<String, _>(col_name) {
                v
            } else if let Ok(v) = row.try_get::<i64, _>(col_name) {
                v.to_string()
            } else if let Ok(v) = row.try_get::<f64, _>(col_name) {
                v.to_string()
            } else if let Ok(v) = row.try_get::<bool, _>(col_name) {
                v.to_string()
            } else if let Ok(v) = row.try_get::<i32, _>(col_name) {
                 v.to_string()
            } else if let Ok(v) = row.try_get::<f32, _>(col_name) {
                 v.to_string()
            } else {
                 // Try getting as bytes or fallback
                 "<blob/unknown>".to_string()
            };
            row_vals.push(val);
        }
        refined_data_rows.push(row_vals);
    }

    Ok(TablePreview {
        columns,
        rows: refined_data_rows,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(DbState::new())
        .invoke_handler(tauri::generate_handler![
            mysql_connect_server,
            mysql_select_database,
            mysql_list_tables,
            mysql_preview_table
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
