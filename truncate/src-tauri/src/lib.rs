use std::path::PathBuf;
use tauri::Manager;
use tauri::{Emitter, State}; // For path access

pub mod adapter;
pub mod ai_copilot;
pub mod api_proxy;
pub mod csv_adapter;
pub mod data_profiling;
pub mod db_state;
pub mod keychain;
pub mod mysql_adapter;
pub mod postgres_adapter;
pub mod schema;
pub mod sql_utils;
pub mod sqlite_adapter;
pub mod subscription;
pub mod terminal;
pub mod types;

use crate::adapter::{DatabaseAdapter, DbAdapter};
use crate::csv_adapter::CsvAdapter;
use crate::db_state::DbState;
use crate::mysql_adapter::MySqlAdapter;
use crate::postgres_adapter::PostgresAdapter;
use crate::sqlite_adapter::SqliteAdapter;
use crate::terminal::{
    resize_terminal, start_terminal, start_terminal_auto, stop_terminal, write_terminal,
    TerminalState,
};
use crate::types::{QueryResult, TablePreview};

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
        "csv" => DbAdapter::Csv(CsvAdapter::new(&host, &user)?),  // Host=path, User=config_json
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
    window
        .emit("db-switched", &database_name)
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn list_tables(state: State<'_, DbState>) -> Result<Vec<String>, String> {
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

    // Execute
    let mut result = adapter.execute_query(&sql).await?;

    // Inject Formatted Text for Terminal
    if let QueryResult::ResultSet(ref mut preview) = result {
        let col_names: Vec<String> = preview.columns.iter().map(|c| c.name.clone()).collect();
        let formatted = crate::sql_utils::format_table(&col_names, &preview.rows);
        preview.formatted_output = Some(formatted);
    }

    // Check for schema changes
    if let Some(stmt) = crate::sql_utils::get_last_statement(&sql) {
        let sql_type = crate::sql_utils::get_sql_type(&stmt);
        match sql_type {
            crate::sql_utils::SqlType::Create
            | crate::sql_utils::SqlType::Drop
            | crate::sql_utils::SqlType::Alter => {
                let _ = window.emit("schema-changed", ());
            }
            _ => {}
        }
    }

    // Emit result for UI Sync (Preview Panel)
    let _ = window.emit("query-executed", &result);

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
    let (schema, _db_name) = {
        let guard = state.adapter.lock().await;
        let adapter = guard.as_ref().ok_or("No active connection")?;
        let db = adapter.get_current_database().await?;
        let s = adapter.extract_schema(&db).await?;
        (s, db)
    };

    // 2. Determine download path
    let download_path = app_handle
        .path()
        .download_dir()
        .unwrap_or(PathBuf::from("."));

    // 3. Save Files (sync file io is okay here, or make async)
    crate::schema::save_schema_files(&schema, &download_path, &app_handle)
}

#[tauri::command]
async fn drop_database(
    window: tauri::Window,
    state: State<'_, DbState>,
    database_name: String,
) -> Result<(), String> {
    let mut guard = state.adapter.lock().await;
    let adapter = guard.as_mut().ok_or("No active connection")?;

    // 1. Check if we are deleting the CURRENT active database
    let current_db_res = adapter.get_current_database().await;

    // Some adapters might fail to get current DB, ignore that for check if needed or handle gracefully
    if let Ok(current) = current_db_res {
        if current == database_name {
            // Dangerous! We need to switch away first.
            let config = adapter.get_connection_config();
            match config.db_type {
                crate::adapter::ConnectionType::MySQL => {
                    // Switch to 'mysql' or 'information_schema'? 'mysql' is standard system DB.
                    // Or just 'sys'? 'mysql' is usually safe choice for admin connection.
                    let _ = adapter.switch_database("mysql").await;
                    // Update UI that we switched?
                    let _ = window.emit("db-switched", "mysql");
                }
                crate::adapter::ConnectionType::PostgreSQL => {
                    let _ = adapter.switch_database("postgres").await;
                    let _ = window.emit("db-switched", "postgres");
                }
                _ => {
                    // For others, maybe we can't switch?
                }
            }
        }
    }

    // 2. Perform Drop
    adapter.drop_database(&database_name).await?;

    Ok(())
}

#[tauri::command]
async fn run_data_profiling(
    state: State<'_, DbState>,
    table_name: String,
) -> Result<crate::data_profiling::TableProfile, String> {
    let guard = state.adapter.lock().await;
    let adapter = guard.as_ref().ok_or("No active connection")?;

    crate::data_profiling::profile_table(adapter, &table_name).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(DbState::new())
        .manage(TerminalState::new())
        .setup(|app| {
            // Start Ollama Sidecar
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                ai_copilot::start_ollama(&handle);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            connect_server,
            select_database,
            list_tables,
            preview_table,
            sql_run_query,
            disconnect_database,
            export_database_schema,
            drop_database,
            start_terminal,
            write_terminal,
            resize_terminal,
            start_terminal_auto,
            stop_terminal,
            refresh_databases,
            refresh_databases,
            inspect_csv,
            ai_copilot::ask_copilot,
            ai_copilot::check_ai_status,
            ai_copilot::is_engine_installed,
            ai_copilot::sync_engine_assets,
            ai_copilot::ask_audit_ai,
            run_data_profiling,
            keychain::set_keychain_token,
            keychain::get_keychain_token,
            keychain::delete_keychain_token,
            api_proxy::api_proxy,
            subscription::get_subscription_status
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                ai_copilot::stop_ollama(app_handle);
            }
        });
}
