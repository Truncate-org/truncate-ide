use crate::error::TruncateError;
use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

pub struct CliDiscoveryService;

impl CliDiscoveryService {
    /// Discovers the full path to a given CLI tool.
    /// Checks the current PATH env vars and falls back to manual resolution.
    pub fn discover_cli(tool_name: &str) -> Result<PathBuf, TruncateError> {
        #[cfg(windows)]
        let tool_name = if tool_name.ends_with(".exe") {
            tool_name.to_string()
        } else {
            format!("{}.exe", tool_name)
        };
        #[cfg(not(windows))]
        let tool_name = tool_name.to_string();

        // 1. Check if it's already in the PATH seamlessly
        if Command::new(&tool_name).arg("--version").output().is_ok() {
            return Ok(PathBuf::from(&tool_name));
        }

        // 2. Manual Resolution
        let common_paths = Self::get_common_paths();
        for path_str in common_paths {
            let full_path = Path::new(path_str).join(&tool_name);
            if full_path.exists() {
                // Ensure it's executable
                if Command::new(&full_path).arg("--version").output().is_ok() {
                    return Ok(full_path);
                }
            }
        }

        // 3. Not found
        let hint = match tool_name.as_str() {
            "mysql" | "mysql.exe" => {
                #[cfg(windows)]
                {
                    "Please install MySQL and ensure it is in your C:\\Program Files\\MySQL directory."
                }
                #[cfg(not(windows))]
                {
                    "You can install it via 'brew install mysql-client' on macOS or 'sudo apt-get install mysql-client' on Linux."
                }
            }
            "psql" | "psql.exe" => {
                #[cfg(windows)]
                {
                    "Please install PostgreSQL and ensure it is in your C:\\Program Files\\PostgreSQL directory."
                }
                #[cfg(not(windows))]
                {
                    "You can install it via 'brew install postgresql' on macOS or 'sudo apt-get install postgresql-client' on Linux."
                }
            }
            "sqlite3" | "sqlite3.exe" => {
                #[cfg(windows)]
                {
                    "Please download sqlite3.exe and add it to your PATH."
                }
                #[cfg(not(windows))]
                {
                    "You can install it via 'brew install sqlite' on macOS or 'sudo apt-get install sqlite3' on Linux."
                }
            }
            "ollama" | "ollama.exe" => {
                "Please download and install Ollama from https://ollama.com/download"
            }
            _ => "Please install the requested CLI tool.",
        };

        Err(TruncateError::CliNotFound {
            tool: tool_name.clone(),
            install_hint: hint.to_string(),
        })
    }

    /// Enriches the Command's environment PATH variable with the directory where the
    /// resolved binary lives. This prevents subprocesses launched by the CLI from failing.
    pub fn enrich_cmd_env(cmd: &mut portable_pty::CommandBuilder, resolved_bin: &PathBuf) {
        if let Some(parent) = resolved_bin.parent() {
            if let Some(current_path) = env::var_os("PATH") {
                let mut paths = env::split_paths(&current_path).collect::<Vec<_>>();
                // Insert at the beginning to prioritize
                paths.insert(0, parent.to_path_buf());
                if let Ok(new_path) = env::join_paths(paths) {
                    cmd.env("PATH", new_path);
                }
            } else {
                cmd.env("PATH", parent);
            }
        }
    }

    // --- Private Helpers ---

    #[cfg(windows)]
    fn get_common_paths() -> Vec<&'static str> {
        // We could also dynamically search C:\Program Files\MySQL\*\bin but
        // string iter is okay for hardcoded constraints.
        vec![
            "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin", // Provide more common versions as needed
            "C:\\Program Files\\MySQL\\MySQL Server 8.1\\bin",
            "C:\\Program Files\\PostgreSQL\\15\\bin",
            "C:\\Program Files\\PostgreSQL\\16\\bin",
            "C:\\Program Files\\PostgreSQL\\17\\bin",
            "C:\\Windows\\System32",
        ]
    }

    #[cfg(not(windows))]
    fn get_common_paths() -> Vec<&'static str> {
        vec![
            "/usr/local/bin",
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            // Specific overrides
            "/opt/homebrew/opt/mysql-client/bin",
            "/usr/local/opt/mysql-client/bin",
            "/opt/homebrew/opt/libpq/bin",
            "/usr/local/opt/libpq/bin",
        ]
    }
}
