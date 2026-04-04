use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PullProgress {
    pub status: String,
    pub digest: Option<String>,
    pub total: Option<u64>,
    pub completed: Option<u64>,
}

#[derive(Serialize, Clone)]
pub struct SetupProgressEvent {
    pub message: String,
    pub percent: f64,
}

// Maps raw Ollama status strings to user-friendly "COD trick" messages
fn map_status_message(status: &str) -> String {
    let lower = status.to_lowercase();
    if lower.contains("manifest") {
        "Preparing your workspace...".to_string()
    } else if lower.contains("pulling") {
        "Downloading AI engine...".to_string()
    } else if lower.contains("verifying") {
        "Verifying components...".to_string()
    } else if lower.contains("writing") {
        "Finalizing setup...".to_string()
    } else if lower.contains("success") {
        "Ready.".to_string()
    } else {
        format!("Setting up: {}", status)
    }
}

// Checks if the target model is installed
async fn is_model_installed(client: &Client, model_name: &str) -> bool {
    #[derive(Deserialize)]
    struct OllamaModel {
        name: String,
    }
    #[derive(Deserialize)]
    struct OllamaTags {
        models: Vec<OllamaModel>,
    }

    let url = "http://127.0.0.1:11434/api/tags";
    if let Ok(res) = client.get(url).send().await {
        if let Ok(tags) = res.json::<OllamaTags>().await {
            return tags.models.iter().any(|m| m.name.contains(model_name));
        }
    }
    false
}

#[tauri::command]
pub async fn initialize_ai(app: AppHandle) -> Result<(), String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let model_to_pull = "qwen2.5-coder:latest";

    // 1. Initial Emit
    let _ = app.emit(
        "setup-progress",
        SetupProgressEvent {
            message: "Starting engine...".to_string(),
            percent: 5.0,
        },
    );

    // 2. Discover/Launch Sidecar if HTTP ping fails
    let ping_res = client.get("http://127.0.0.1:11434/").send().await;
    if ping_res.is_err() {
        let _ = app.emit(
            "setup-progress",
            SetupProgressEvent {
                message: "Launching private AI kernel...".to_string(),
                percent: 10.0,
            },
        );

        // Launch sidecar correctly using Tauri Shell API
        match app.shell().sidecar("ollama") {
            Ok(sidecar) => {
                // We just spawn "serve" via sidecar
                let (_, _) = sidecar.args(["serve"]).spawn().map_err(|e| e.to_string())?;
                // Wait for it to boot up
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
            }
            Err(e) => {
                return Err(format!(
                    "Failed to retrieve sidecar: {}. Ensure binaries are built.",
                    e
                ));
            }
        }
    }

    // 3. Check if Model exists
    if is_model_installed(&client, "qwen2.5-coder").await {
        let _ = app.emit(
            "setup-progress",
            SetupProgressEvent {
                message: "Ready.".to_string(),
                percent: 100.0,
            },
        );
        return Ok(()); // We're fully setup
    }

    // 4. Stream the Model Pull
    let url = "http://127.0.0.1:11434/api/pull";
    let payload = serde_json::json!({
        "name": model_to_pull,
        "stream": true
    });

    let res = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.split('\n') {
            if line.trim().is_empty() {
                continue;
            }
            if let Ok(progress) = serde_json::from_str::<PullProgress>(line) {
                let friendly_message = map_status_message(&progress.status);
                let mut percent = 15.0; // Base percent just for being in the pulling phase

                if let (Some(total), Some(completed)) = (progress.total, progress.completed) {
                    if total > 0 {
                        // Rescale download from 15% to 90%
                        percent = 15.0 + ((completed as f64 / total as f64) * 75.0);
                    }
                } else if progress.status.to_lowercase().contains("success") {
                    percent = 100.0;
                }

                let _ = app.emit(
                    "setup-progress",
                    SetupProgressEvent {
                        message: friendly_message,
                        percent,
                    },
                );
            }
        }
    }

    Ok(())
}
