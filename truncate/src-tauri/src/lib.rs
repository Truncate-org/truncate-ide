use tauri::{State, Emitter};
use sqlx::mysql::{MySqlPoolOptions, MySqlConnectOptions, MySqlRow};
use sqlx::{Row, Column, TypeInfo, ValueRef};
use std::time::Duration;
use crate::db_state::{DbState, ConnectionConfig};
use crate::sql_utils::{get_sql_type, extract_db_name, is_safe_for_mvp, has_limit_clause, validate_sql_structure, SqlType};

pub mod db_state;
pub mod sql_utils;

#[derive(serde::Serialize)]
pub struct TablePreview {
    columns: Vec<String>,
    rows: Vec<Vec<String>>,
    limited: bool,
}

#[derive(serde::Serialize)]
#[serde(tag = "type", content = "data")]
pub enum QueryResult {
    ResultSet(TablePreview),
    Success(String),
}

// Helper to switch database internally
async fn switch_db_internal(state: &State<'_, DbState>, db_name: &str) -> Result<(), String> {
    let config = {
        let guard = state.config.lock().unwrap();
        guard.clone().ok_or("No active connection")?
    };

    let options = MySqlConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .username(&config.user)
        .password(&config.pass)
        .database(db_name);

    let pool = MySqlPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(5))
        .connect_with(options)
        .await
        .map_err(|e| format!("Failed to connect to database {}: {}", db_name, e))?;

    *state.pool.lock().unwrap() = Some(pool);
    Ok(())
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
    window: tauri::Window,
    state: State<'_, DbState>,
    database_name: String,
) -> Result<(), String> {
    switch_db_internal(&state, &database_name).await?;
    
    // Emit event for UI sync
    window.emit("db-switched", &database_name)
        .map_err(|e| format!("Failed to emit event: {}", e))?;

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
    
    let rows: Vec<MySqlRow> = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to preview table: {}", e))?;

    map_rows_to_preview(rows, true)
}

#[tauri::command]
async fn sql_run_query(
    window: tauri::Window,
    state: State<'_, DbState>,
    sql: String,
) -> Result<QueryResult, String> {
    let sql_type = get_sql_type(&sql);

    // 1. Safety Check
    if !is_safe_for_mvp(&sql_type) {
        return Err("Destructive queries (UPDATE, DELETE, DROP, etc.) are disabled in this version.".into());
    }

    // 2. Handle USE command
    if sql_type == SqlType::Use {
        if let Some(db_name) = extract_db_name(&sql) {
            switch_db_internal(&state, &db_name).await?;
            window.emit("db-switched", &db_name)
                .map_err(|e| format!("Failed to emit event: {}", e))?;
            return Ok(QueryResult::Success(format!("Active database switched to: {}", db_name)));
        } else {
            return Err("Invalid USE command syntax".into());
        }
    }

    // 3. Handle SELECT / SHOW / DESCRIBE
    let pool = {
        let guard = state.pool.lock().unwrap();
        guard.as_ref().ok_or("No active database selected")?.clone()
    };

    // Normalize SQL: trim whitespace and remove trailing semicolon
    let mut normalized_sql = sql.trim().to_string();
    if normalized_sql.ends_with(';') {
        normalized_sql.pop();
    }
    
    // 4. Validate SQL Structure (e.g. SELECT needs FROM)
    // IMPORTANT: Perform after normalization but before execution
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
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Query failed: {}", e))?;

    let preview = map_rows_to_preview(rows, was_limited)?;
    Ok(QueryResult::ResultSet(preview))
}

// Helper to map rows to TablePreview
fn map_rows_to_preview(rows: Vec<MySqlRow>, limited: bool) -> Result<TablePreview, String> {
    if rows.is_empty() {
        return Ok(TablePreview { columns: vec![], rows: vec![], limited: false });
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
            mysql_preview_table,
            sql_run_query
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
