use crate::adapter::{ConnectionType, DatabaseAdapter};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{Emitter, State};

pub struct TerminalSession {
    pub writer: Box<dyn Write + Send>,
    pub master: Box<dyn portable_pty::MasterPty + Send>,
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
}

pub struct TerminalState {
    pub sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

impl TerminalState {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Default for TerminalState {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

use crate::db_state::DbState;

#[tauri::command]
pub async fn start_terminal_auto(
    window: tauri::Window,
    state: State<'_, TerminalState>,
    db_state: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    // Retrieve active connection config
    let config = {
        let guard = db_state.adapter.lock().await;
        let adapter = guard
            .as_ref()
            .ok_or("No active database connection found")?;
        adapter.get_connection_config()
    };

    let bin;
    let mut args = Vec::new();

    match config.db_type {
        ConnectionType::MySQL => {
            bin = "mysql".to_string();
            // mysql -h host -P port -u user -pPASS [database]
            args.push("-h".to_string());
            args.push(config.host.clone());
            args.push("-P".to_string());
            args.push(config.port.to_string());
            args.push("-u".to_string());
            args.push(config.user.clone());

            if !config.pass.is_empty() {
                args.push(format!("-p{}", config.pass));
            }

            if let Some(db_name) = config.current_database {
                args.push(db_name);
            }
        }
        ConnectionType::PostgreSQL => {
            bin = "psql".to_string();
            // psql "postgresql://user:pass@host:port/dbname"
            // or args: -h host -p port -U user -d dbname
            // We need to clear password potentially if using args, passing via env is better.
            // PGPASSWORD env var.
            // But portable-pty allows env vars.

            args.push("-h".to_string());
            args.push(config.host.clone());
            args.push("-p".to_string());
            args.push(config.port.to_string());
            args.push("-U".to_string());
            args.push(config.user.clone());
            args.push("-d".to_string());
            args.push(
                config
                    .current_database
                    .clone()
                    .unwrap_or_else(|| "postgres".to_string()),
            );

            // For password, we'll try to set env var but NativePtySystem might inherit.
            // We can pass password in connection string but that shows in ps.
            // But strict requirement: "Seamless".
            // We will pass env in `start_terminal` if modified to accept it,
            // or just set it in current process scope temporarily (bad idea for threaded).

            // `portable_pty::CommandBuilder` has `env` method.
            // We need to modify `start_terminal` to accept env map.
        }
        ConnectionType::SQLite | ConnectionType::Csv => {
            bin = "sqlite3".to_string();
            if let Some(db_path) = config.current_database {
                args.push(db_path);
            }
        }
    }

    // Call start_terminal with env if needed
    start_terminal_with_env(
        window,
        state,
        id,
        bin,
        args,
        None,
        if config.db_type == ConnectionType::PostgreSQL {
            let mut map = HashMap::new();
            map.insert("PGPASSWORD".to_string(), config.pass.clone());
            Some(map)
        } else {
            None
        },
    )
}

#[tauri::command]
pub fn start_terminal(
    window: tauri::Window,
    state: State<'_, TerminalState>,
    id: String,
    bin: String,
    args: Vec<String>,
    cwd: Option<String>,
) -> Result<(), String> {
    start_terminal_with_env(window, state, id, bin, args, cwd, None)
}

// Inner helper
fn start_terminal_with_env(
    window: tauri::Window,
    state: State<'_, TerminalState>,
    id: String,
    bin: String,
    args: Vec<String>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
) -> Result<(), String> {
    // Proactive check for binary existence to give better error message
    let resolved_bin = match get_binary_path(&bin) {
        Some(path) => path,
        None => {
            let install_hint = match bin.as_str() {
                "mysql" => "You can install it via 'brew install mysql-client' on macOS or 'sudo apt-get install mysql-client' on Linux.",
                "psql" => "You can install it via 'brew install postgresql' on macOS or 'sudo apt-get install postgresql-client' on Linux.",
                "sqlite3" => "You can install it via 'brew install sqlite' on macOS or 'sudo apt-get install sqlite3' on Linux.",
                _ => "Please ensure the required CLI tool is installed and available in your PATH."
            };
            return Err(format!(
                "The required database CLI tool '{}' was not found on your system. {}",
                bin, install_hint
            ));
        }
    };

    let pty_system = NativePtySystem::default();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(&resolved_bin);
    cmd.args(&args);

    if let Some(dir) = cwd {
        cmd.cwd(dir);
    }

    if let Some(env_vars) = env {
        for (k, v) in env_vars {
            cmd.env(k, v);
        }
    }

    // Spawn the process in the pty
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    // Store session
    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(
            id.clone(),
            TerminalSession {
                writer,
                master: pair.master,
                child,
            },
        );
    }

    // Spawn reader thread
    let id_clone = id.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let data = &buf[..n];
                    let text = String::from_utf8_lossy(data).to_string();
                    if window
                        .emit("terminal-output", (id_clone.clone(), text))
                        .is_err()
                    {
                        break;
                    }
                }
                Ok(_) => break,  // EOF
                Err(_) => break, // Error
            }
        }
        let _ = window.emit("terminal-exit", id_clone);
    });

    Ok(())
}

#[tauri::command]
pub fn write_terminal(
    state: State<'_, TerminalState>,
    id: String,
    data: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&id) {
        write!(session.writer, "{}", data).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Session not found".to_string())
    }
}

#[tauri::command]
pub fn resize_terminal(
    state: State<'_, TerminalState>,
    id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&id) {
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Session not found".to_string())
    }
}

#[tauri::command]
pub fn stop_terminal(state: State<'_, TerminalState>, id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(mut session) = sessions.remove(&id) {
        // Dropping the session (which contains the PtyMaster) should terminate the process.
        // Explicitly kill the child to avoid orphans.
        let _ = session.child.kill();
        Ok(())
    } else {
        Ok(())
    }
}

fn get_binary_path(bin: &str) -> Option<String> {
    use std::process::Command;

    #[cfg(windows)]
    let bin_with_ext = if bin.ends_with(".exe") {
        bin.to_string()
    } else {
        format!("{}.exe", bin)
    };
    #[cfg(not(windows))]
    let bin_with_ext = bin.to_string();

    // 1. Check if it's already in the PATH
    if Command::new(&bin_with_ext)
        .arg("--version")
        .output()
        .is_ok()
    {
        return Some(bin_with_ext);
    }

    // 2. Search common paths (macOS/Linux only for now)
    #[cfg(not(windows))]
    {
        let common_paths = vec![
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/opt/homebrew/opt/mysql-client/bin",
            "/usr/local/opt/mysql-client/bin",
            "/opt/homebrew/opt/libpq/bin", // psql client-only
            "/usr/local/opt/libpq/bin",     // psql client-only
        ];

        for path in common_paths {
            let full_path = std::path::Path::new(path).join(&bin_with_ext);
            if full_path.exists() {
                // Double check it's actually executable and works
                if Command::new(&full_path).arg("--version").output().is_ok() {
                    return Some(full_path.to_string_lossy().to_string());
                }
            }
        }
    }

    None
}

#[allow(dead_code)]
fn is_binary_available(bin: &str) -> bool {
    get_binary_path(bin).is_some()
}
