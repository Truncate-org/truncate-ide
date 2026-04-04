use crate::error::TruncateError;
use crate::services::cli_discovery::CliDiscoveryService;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(tag = "status", content = "models")] // e.g {"status": "Running", "models": ["qwen..."]}
pub enum OllamaStatus {
    Running(Vec<String>),
    NotRunning,
    NotInstalled,
}

#[derive(Deserialize)]
struct OllamaModel {
    name: String,
}

#[derive(Deserialize)]
struct OllamaTags {
    models: Vec<OllamaModel>,
}

pub struct OllamaService;

impl OllamaService {
    /// Checks the current status of the Ollama service.
    /// Returns 
    /// - `Running(models)` if HTTP connects successfully.
    /// - `NotRunning` if HTTP fails but the CLI is found on the system.
    /// - `NotInstalled` if HTTP fails and CLI is not found.
    pub async fn check_status() -> Result<OllamaStatus, TruncateError> {
        // 1. Try HTTP Ping (2 seconds timeout)
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(2))
            .build()
            .map_err(|e| TruncateError::InternalError {
                message: format!("Failed to build HTTP client: {}", e),
            })?;

        let res_result = client.get("http://127.0.0.1:11434/api/tags").send().await;

        if let Ok(res) = res_result {
            if res.status().is_success() {
                if let Ok(tags) = res.json::<OllamaTags>().await {
                    let mut models = Vec::new();
                    for m in tags.models {
                        models.push(m.name);
                    }
                    return Ok(OllamaStatus::Running(models));
                }
            }
        }

        // 2. HTTP failed. Fall back to finding the CLI binary.
        let cli_result = CliDiscoveryService::discover_cli("ollama");
        if cli_result.is_ok() {
            // It is installed but not running
            Ok(OllamaStatus::NotRunning)
        } else {
            // Neither HTTP is running, nor is CLI found
            Ok(OllamaStatus::NotInstalled)
        }
    }
}

// --- process tracking ---
use std::sync::Mutex;
use std::process::Child;
use once_cell::sync::Lazy;

static OLLAMA_PROCESS: Lazy<Mutex<Option<Child>>> = Lazy::new(|| Mutex::new(None));

// --- Tauri Commands ---

#[tauri::command]
pub async fn check_ollama_status() -> Result<OllamaStatus, TruncateError> {
    OllamaService::check_status().await
}

#[tauri::command]
pub async fn launch_ollama(_app: tauri::AppHandle) -> Result<(), TruncateError> {
    let mut proc_guard = OLLAMA_PROCESS.lock().unwrap();
    if proc_guard.is_some() {
        return Ok(()); // Already running from our perspective
    }

    let cli_path = CliDiscoveryService::discover_cli("ollama")?;

    match std::process::Command::new(cli_path)
        .arg("serve")
        .spawn()
    {
        Ok(child) => {
            *proc_guard = Some(child);
            Ok(())
        }
        Err(e) => Err(TruncateError::InternalError {
            message: format!("Failed to launch ollama process: {}", e),
        }),
    }
}

pub fn stop_ollama() {
    let mut proc_guard = OLLAMA_PROCESS.lock().unwrap();
    if let Some(mut child) = proc_guard.take() {
        let _ = child.kill();
    }
}
