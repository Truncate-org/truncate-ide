use tauri::State;
use serde::{Deserialize, Serialize};
use crate::db_state::DbState;
use crate::schema::Schema;
use crate::adapter::DatabaseAdapter;
use std::collections::HashMap;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use tokio::task::AbortHandle;

// -----------------------------------------------------------------------------
// 1. Data Structures
// -----------------------------------------------------------------------------

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<Message>,
    stream: bool,
    options: HashMap<String, serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone)]
struct Message {
    role: String,
    content: String,
}



// Global handle for the active AI request to allow cancellation
static ACTIVE_REQUEST: Lazy<Mutex<Option<AbortHandle>>> = Lazy::new(|| Mutex::new(None));

// -----------------------------------------------------------------------------
// 2. System Prompt
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT: &str = include_str!("../context/AI_context.md");

// -----------------------------------------------------------------------------
// 3. Schema Helper
// -----------------------------------------------------------------------------

fn build_schema_context(schema: &Schema, db_type: &str) -> String {
    let mut context = String::new();
    context.push_str("==== ACTIVE DATABASE SCHEMA ====\n");
    context.push_str(&format!("DATABASE TYPE: {}\n", db_type.to_uppercase()));
    context.push_str(&format!("DATABASE NAME: {}\n\n", schema.database_name));
    context.push_str("TABLES:\n");

    for table in &schema.tables {
        let cols: Vec<String> = table.columns.iter()
            .map(|c| format!("{} {}", c.name, c.data_type))
            .collect();
        context.push_str(&format!("- {}({})\n", table.name, cols.join(", ")));
    }
    context.push_str("================================\n");
    
    context
}

// -----------------------------------------------------------------------------
// 4. Model Resolution
// -----------------------------------------------------------------------------

#[derive(Deserialize)]
struct OllamaModel { name: String }
#[derive(Deserialize)]
struct OllamaTags { models: Vec<OllamaModel> }

async fn resolve_model_name() -> Result<String, String> {
    let client = reqwest::Client::new();
    // Short implementation of dynamic model logic
    let res = client.get("http://127.0.0.1:11434/api/tags").send().await
        .map_err(|e| e.to_string())?;
    
    if !res.status().is_success() { return Err("Ollama offline".to_string()); }
    
    let tags: OllamaTags = res.json().await.map_err(|e| e.to_string())?;
    let all_models: Vec<String> = tags.models.into_iter().map(|m| m.name).collect();

    if all_models.contains(&"qwen2.5-coder:latest".to_string()) {
        return Ok("qwen2.5-coder:latest".to_string());
    }
    if let Some(found) = all_models.iter().find(|m| m.contains("qwen2.5-coder")) {
        return Ok(found.clone());
    }
    Err("Model qwen2.5-coder not found".to_string())
}

// -----------------------------------------------------------------------------
// 5. Commands
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn check_ai_status() -> Result<crate::ai_copilot::AiStatus, String> {
    match resolve_model_name().await {
        Ok(name) => Ok(crate::ai_copilot::AiStatus {
            online: true, model_loaded: true, message: format!("Ready ({})", name)
        }),
        Err(e) => Ok(crate::ai_copilot::AiStatus {
            online: false, model_loaded: false, message: e
        })
    }
}

// Status Struct (Public for Lib usage if needed)
#[derive(Serialize)]
pub struct AiStatus {
    pub online: bool,
    pub model_loaded: bool,
    pub message: String,
}

#[tauri::command]
pub async fn cancel_ai_request() {
    let mut handle_lock = ACTIVE_REQUEST.lock().unwrap();
    if let Some(handle) = handle_lock.take() {
        handle.abort();
        println!("AI Request Cancelled by User");
    }
}

#[tauri::command]
pub async fn ask_copilot(
    app: tauri::AppHandle,
    state: State<'_, DbState>,
    user_prompt: String,
) -> Result<String, String> {
    // 1. Cancel previous if any
    {
        let mut handle_lock = ACTIVE_REQUEST.lock().unwrap();
        if let Some(handle) = handle_lock.take() {
            handle.abort();
        }
    }

    // 2. Prepare Context (Synchronously-ish)
    let (schema, db_type) = {
        let guard = state.adapter.lock().await;
        let adapter = guard.as_ref().ok_or("No active DB")?;
        let db_name = adapter.get_current_database().await.map_err(|e| e.to_string())?;
        let s = adapter.extract_schema(&db_name).await.map_err(|e| e.to_string())?;
        let t = format!("{:?}", adapter.get_connection_config().db_type); 
        (s, t)
    };
    
    let model_name = resolve_model_name().await?;
    let schema_ctx = build_schema_context(&schema, &db_type);
    let full_system = format!("{}\n\n{}", SYSTEM_PROMPT, schema_ctx);

    // 3. Blocking Call (Restore reliability)
    let res = query_ollama(&app, full_system, user_prompt, model_name).await;

    match res {
        Ok(response_text) => {
            // Emit done event or just return?
            // User wants "const aiResponse = await callLocalAI".
            // So we should return the text in the Result.
            // But tauri command returns Result to frontend.
             Ok(response_text)
        },
        Err(e) => Err(e)
    }
}

async fn query_ollama(
    _app: &tauri::AppHandle, 
    system: String, 
    prompt: String, 
    model: String
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = "http://127.0.0.1:11434/api/chat";

    let mut options = HashMap::new();
    options.insert("temperature".to_string(), serde_json::json!(0.1));
    options.insert("num_predict".to_string(), serde_json::json!(1024));

    let messages = vec![
        Message { role: "system".to_string(), content: system },
        Message { role: "user".to_string(), content: prompt },
    ];

    let request = OllamaRequest {
        model, messages, stream: false, options
    };

    let res = client.post(url).json(&request).send().await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Ollama API Error: {}", res.status()));
    }

    let body: serde_json::Value = res.json().await
        .map_err(|e| format!("Parse error: {}", e))?;

    // Extract message content
    let content = body["message"]["content"].as_str()
        .ok_or("Invalid response format")?
        .to_string();

    Ok(content)
}

// -----------------------------------------------------------------------------
// 6. Sidecar
// -----------------------------------------------------------------------------
use std::sync::atomic::{AtomicBool, Ordering};
use tauri_plugin_shell::ShellExt;

static OLLAMA_RUNNING: AtomicBool = AtomicBool::new(false);
pub fn start_ollama(app: &tauri::AppHandle) {
    if OLLAMA_RUNNING.load(Ordering::Relaxed) { return; }
    let _ = app.shell().sidecar("ollama").unwrap().args(["serve"]).spawn();
    OLLAMA_RUNNING.store(true, Ordering::Relaxed);
}

pub fn stop_ollama(_app: &tauri::AppHandle) {} // Sidecar dies with parent
