use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{Emitter, State};

pub struct TerminalSession {
    pub writer: Box<dyn Write + Send>,
    pub master: Box<dyn portable_pty::MasterPty + Send>,
}

pub struct TerminalState {
    pub sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

impl TerminalState {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[derive(serde::Deserialize)]
pub struct TerminalSize {
    pub rows: u16,
    pub cols: u16,
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
        let guard = db_state.config.lock().unwrap();
        guard.clone().ok_or("No active database connection found")?
    };

    let bin = "mysql"; // Simplified for MVP. Ideally detect DB type.
    
    // Construct args for mysql
    // mysql -h host -P port -u user -pPASS
    let mut args = vec![
        "-h".to_string(),
        config.host.clone(),
        "-P".to_string(),
        config.port.to_string(),
        "-u".to_string(),
        config.user.clone(),
    ];

    // Password handling
    // WARNING: Passing password in args is insecure in shared environments (`ps` lists it).
    // Better approaches: MYSQL_PWD env var or ~/.my.cnf.
    // For this local-desktop-app MVP, we'll use -pPASSWORD.
    if !config.pass.is_empty() {
         args.push(format!("-p{}", config.pass)); // No space for mysql -p
    }

    start_terminal(window, state, id, bin.to_string(), args, None)
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
    let pty_system = NativePtySystem::default();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(&bin);
    cmd.args(&args);
    if let Some(dir) = cwd {
        cmd.cwd(dir);
    }

    // Spawn the process in the pty
    let _child = pair
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
                    // Emit binary data as base64 or raw string?
                    // xterm.js handles strings well. We might need specific encoding handling.
                    // For now, assume UTF-8 lossy, which is generally fine for valid CLI output.
                    let text = String::from_utf8_lossy(data).to_string();
                    if let Err(e) = window.emit("terminal-output", (id_clone.clone(), text)) {
                        eprintln!("Failed to emit terminal output: {}", e);
                        break;
                    }
                }
                Ok(_) => break, // EOF
                Err(_) => break, // Error
            }
        }
        // Cleanup on exit?
        // Ideally we emit an exit event too.
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
