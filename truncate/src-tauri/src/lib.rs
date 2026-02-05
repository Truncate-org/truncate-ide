use tauri::{State, Emitter};
use std::path::PathBuf;
use tauri::Manager; // For path access

pub mod types;
pub mod adapter;
pub mod mysql_adapter;
pub mod csv_adapter;
pub mod postgres_adapter;
pub mod sqlite_adapter;
pub mod db_state;
pub mod sql_utils;
pub mod schema;
pub mod terminal;

use crate::db_state::DbState;
use crate::adapter::{DatabaseAdapter, DbAdapter};
use crate::mysql_adapter::MySqlAdapter;
use crate::postgres_adapter::PostgresAdapter;
use crate::sqlite_adapter::SqliteAdapter;
use crate::csv_adapter::CsvAdapter;
use crate::types::{QueryResult, TablePreview};
use crate::terminal::{TerminalState, start_terminal, write_terminal, resize_terminal, start_terminal_auto, stop_terminal};

#[tauri::command]
async fn inspect_csv(path: String) -> Result<crate::types::CsvInspection, String> {
    crate::csv_adapter::inspect_csv(&path)
}

#[tauri::command]
async fn connect_server(
    state: State<'_, DbState>,
    db_type: String,
    host: String,
    port: u16,
    user: String,
    pass: String,
) -> Result<Vec<String>, String> {
    
    let mut adapter = match db_type.as_str() {
        "mysql" => DbAdapter::MySql(MySqlAdapter::new(&host, port, &user, &pass)),
        "postgres" => DbAdapter::Postgres(PostgresAdapter::new(&host, port, &user, &pass)),
        "sqlite" => DbAdapter::Sqlite(SqliteAdapter::new(&host)), // Host contains file path
        "csv" => DbAdapter::Csv(CsvAdapter::new(&host, &user)?), // Host=path, User=config_json
        _ => return Err(format!("Unsupported database type: {}", db_type)),
    };

    adapter.connect().await?;
    let databases = adapter.list_databases().await?;
    
    let mut guard = state.adapter.lock().await;
    *guard = Some(adapter);

    Ok(databases)
}

#[tauri::command]
async fn select_database(
    window: tauri::Window,
    state: State<'_, DbState>,
    database_name: String,
) -> Result<(), String> {
    let mut guard = state.adapter.lock().await;
    let adapter = guard.as_mut().ok_or("No active connection")?;
    
    adapter.switch_database(&database_name).await?;
    
    // Emit event for UI sync
    window.emit("db-switched", &database_name)
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn list_tables(
    state: State<'_, DbState>,
) -> Result<Vec<String>, String> {
    let guard = state.adapter.lock().await;
    let adapter = guard.as_ref().ok_or("No active connection")?;
    adapter.list_tables().await
}

#[tauri::command]
async fn preview_table(
    state: State<'_, DbState>,
    table_name: String,
) -> Result<TablePreview, String> {
    let guard = state.adapter.lock().await;
    let adapter = guard.as_ref().ok_or("No active connection")?;
    adapter.preview_table(&table_name).await
}

#[tauri::command]
async fn sql_run_query(
    window: tauri::Window,
    state: State<'_, DbState>,
    sql: String,
) -> Result<QueryResult, String> {
    let guard = state.adapter.lock().await;
    let adapter = guard.as_ref().ok_or("No active connection")?;
    
    let result = adapter.execute_query(&sql).await?;
    
    // Check for schema changes
    if let Some(stmt) = crate::sql_utils::get_last_statement(&sql) {
        let sql_type = crate::sql_utils::get_sql_type(&stmt);
        match sql_type {
            crate::sql_utils::SqlType::Create | 
            crate::sql_utils::SqlType::Drop | 
            crate::sql_utils::SqlType::Alter => {
                let _ = window.emit("schema-changed", ());
            },
            _ => {}
        }
    }

    Ok(result)
}

#[tauri::command]
async fn disconnect_database(state: State<'_, DbState>) -> Result<(), String> {
    let mut guard = state.adapter.lock().await;
    if let Some(mut adapter) = guard.take() {
        adapter.disconnect().await?;
    }
    Ok(())
}

#[tauri::command]
async fn refresh_databases(state: State<'_, DbState>) -> Result<Vec<String>, String> {
    let guard = state.adapter.lock().await;
    let adapter = guard.as_ref().ok_or("No active connection")?;
    adapter.list_databases().await
}

#[tauri::command]
async fn export_database_schema(
    state: State<'_, DbState>,
    app_handle: tauri::AppHandle,
) -> Result<crate::schema::ExportResult, String> {
    // 1. Extract Schema
    let (schema, db_name) = {
        let guard = state.adapter.lock().await;
        let adapter = guard.as_ref().ok_or("No active connection")?;
        let db = adapter.get_current_database().await?;
        let s = adapter.extract_schema(&db).await?;
        (s, db)
    };

    // 2. Determine download path
    let download_path = app_handle.path().download_dir().unwrap_or(PathBuf::from("."));
    
    // 3. Save Files (sync file io is okay here, or make async)
    crate::schema::save_schema_files(&schema, &download_path, &app_handle)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(DbState::new())
        .manage(TerminalState::new())
        .invoke_handler(tauri::generate_handler![
            connect_server,
            select_database,
            list_tables,
            preview_table,
            sql_run_query,
            disconnect_database,
            export_database_schema,
            start_terminal,
            write_terminal,
            resize_terminal,
            start_terminal_auto,
            stop_terminal,
            refresh_databases,
            inspect_csv
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
