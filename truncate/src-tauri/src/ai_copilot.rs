use tauri::State;
use serde::{Deserialize, Serialize};
use crate::db_state::DbState;
use crate::schema::Schema;
use crate::adapter::DatabaseAdapter;
use std::collections::HashMap;
use sqlparser::dialect::{MySqlDialect, PostgreSqlDialect, SQLiteDialect, Dialect};
use sqlparser::parser::Parser;
use sqlparser::ast::{Statement, TableFactor, SetExpr};

// -----------------------------------------------------------------------------
// 1. Data Structures for Ollama & Internal Logic
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

#[derive(Deserialize)]
struct OllamaResponse {
    message: Message,
    // we ignore 'done', 'created_at', etc. for now
}

/// The STRICT output format the AI must follow.
#[derive(Serialize, Deserialize, Debug)]
pub struct AiResponse {
    pub intent: String, // "query" | "explain" | "error" | "conversation"
    pub sql: String,
    pub explanation: String,
    pub confidence: String, // "high" | "low"
    #[serde(default)]
    pub is_safe: bool, // Checked by backend
}

#[derive(Serialize)]
pub struct AiStatus {
    pub online: bool,
    pub model_loaded: bool,
    pub message: String,
}

// -----------------------------------------------------------------------------
// 2. Strict System Prompt Definition
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT: &str = include_str!("../context/AI_context.md");

// -----------------------------------------------------------------------------
// 3. Schema Injection & Prompt Construction
// -----------------------------------------------------------------------------

fn build_schema_context(schema: &Schema, db_type: &str) -> String {
    let mut context = String::new();
    context.push_str(&format!("ACTIVE DATABASE: {}\n", db_type.to_uppercase()));
    context.push_str(&format!("DATABASE NAME: {}\n\n", schema.database_name));
    context.push_str("TABLES:\n");

    for table in &schema.tables {
        // "tablename(col1 TYPE, col2 TYPE)" format
        let cols: Vec<String> = table.columns.iter()
            .map(|c| format!("{} {}", c.name, c.data_type))
            .collect();
        context.push_str(&format!("{}({})\n", table.name, cols.join(", ")));
        // Note: We could add keys here if available in Schema struct
    }

    context.push_str("\nConstraints:\n");
    context.push_str("- Use ONLY the schema above.\n");
    context.push_str("- If a table or column is missing, you must say you cannot answer.\n");
    
    context
}

// -----------------------------------------------------------------------------
// 4. Robust SQL Validation (Anti-Hallucination)
// -----------------------------------------------------------------------------

fn get_dialect(db_type: &str) -> Box<dyn Dialect> {
    match db_type.to_lowercase().as_str() {
        "mysql" => Box::new(MySqlDialect {}),
        "postgresql" | "postgres" => Box::new(PostgreSqlDialect {}),
        _ => Box::new(SQLiteDialect {}), // Default to SQLite (also for generic/CSV)
    }
}

/// Visits AST to find all table names
fn extract_tables_from_query(sql: &str, dialect: &dyn Dialect) -> Result<Vec<String>, String> {
    let ast = Parser::parse_sql(dialect, sql).map_err(|e| e.to_string())?;
    let mut tables = Vec::new();

    for statement in ast {
        if let Statement::Query(query) = statement {
            if let SetExpr::Select(select) = *query.body {
                for table_with_joins in select.from {
                    match table_with_joins.relation {
                        TableFactor::Table { name, .. } => {
                            // Extract just the name, ignoring aliases/schema prefixes for now or handling them simple
                            // name is ObjectName(Vec<Ident>)
                            let raw_name = name.to_string().replace("\"", "").replace("`", ""); // Simple cleanup
                            tables.push(raw_name);
                        },
                        _ => {}
                    }
                    for join in table_with_joins.joins {
                        if let TableFactor::Table { name, .. } = join.relation {
                           let raw_name = name.to_string().replace("\"", "").replace("`", "");
                           tables.push(raw_name);
                        }
                    }
                }
            }
        }
    }
    Ok(tables)
}

/// Validates that:
/// 1. SQL parses correctly for the dialect.
/// 2. All referenced tables exist in the Schema.
/// 3. No destructive commands (DROP, etc.) unless strictly controlled (already checked by prompt, but double check here).
fn validate_ai_response(response: &mut AiResponse, schema: &Schema, db_type: &str) -> Result<(), String> {
    // If no SQL, nothing to validate
    if response.sql.trim().is_empty() {
        response.is_safe = true;
        return Ok(());
    }

    // 1. Structural/Safety Check
    let upper = response.sql.to_uppercase();
    if upper.contains("DROP ") || upper.contains("DELETE ") || upper.contains("TRUNCATE ") || upper.contains("ALTER ") {
         // Mark as unsafe, but don't error out entirely? 
         // Strategy: The prompt says "NEVER auto-generate destructive SQL".
         // If present, it's risky. We mark is_safe = false.
         response.is_safe = false;
         // We could return an error to force retry? Let's force retry to be safe.
         return Err("Destructive SQL (DROP/DELETE/ALTER) detected. This is not allowed without explicit user confirmation override foundation.".to_string());
    }

    // 2. Syntax & Schema Check
    let dialect = get_dialect(db_type);
    let extracted_tables = extract_tables_from_query(&response.sql, &*dialect)
        .map_err(|e| format!("Invalid SQL Syntax: {}", e))?;

    let schema_tables: Vec<String> = schema.tables.iter().map(|t| t.name.to_lowercase()).collect();

    for table in extracted_tables {
        let t_lower = table.to_lowercase();
        if !schema_tables.contains(&t_lower) {
            return Err(format!("Hallucination detected: Table '{}' does not exist in the active schema.", table));
        }
    }

    response.is_safe = true;
    Ok(())
}

// -----------------------------------------------------------------------------
// 5. Ollama Communication
// -----------------------------------------------------------------------------

async fn query_ollama(system_msg: String, user_msg: String, model: String) -> Result<AiResponse, String> {
    let client = reqwest::Client::new();
    let url = "http://localhost:11434/api/chat";

    // Configure model parameters for deterministic output
    let mut options = HashMap::new();
    options.insert("temperature".to_string(), serde_json::json!(0.1)); // STRICT: 0.1
    options.insert("top_p".to_string(), serde_json::json!(0.9));
    options.insert("max_tokens".to_string(), serde_json::json!(1024));
    options.insert("repeat_penalty".to_string(), serde_json::json!(1.1));

    let messages = vec![
        Message { role: "system".to_string(), content: system_msg },
        Message { role: "user".to_string(), content: user_msg },
    ];

    let request = OllamaRequest {
        model: model.clone(),
        messages,
        stream: false, // STRICT: No streaming to allow validation
        options,
    };

    let res = client.post(url)
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama (Is it running?): {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let error_text = res.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Ollama API Error ({}) - Details: {}", status, error_text));
    }

    let ollama_res: OllamaResponse = res.json().await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    let raw_content = ollama_res.message.content;

    // Attempt to parse internal JSON
    match serde_json::from_str::<AiResponse>(&raw_content) {
        Ok(parsed) => Ok(parsed),
        Err(_) => {
            // Failure handling: Attempt to strip markdown code blocks if present
            let cleaned = raw_content.trim()
                .trim_start_matches("```json")
                .trim_start_matches("```")
                .trim_end_matches("```")
                .trim();
                
             let parsed = serde_json::from_str::<AiResponse>(cleaned)
                .map_err(|e| format!("Model returned invalid JSON: {}. Raw: {}", e, raw_content))?;
             
             Ok(parsed)
        }
    }
}

// -----------------------------------------------------------------------------
// 6. Main Command Handler
// -----------------------------------------------------------------------------

#[derive(Deserialize)]
struct OllamaModel {
    name: String,
}

#[derive(Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModel>,
}

async fn resolve_model_name() -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = "http://localhost:11434/api/tags";

    let res = client.get(url).send().await
        .map_err(|e| format!("Failed to connect to Ollama to check models: {}", e))?;
    
    if !res.status().is_success() {
        return Err(format!("Ollama API Error when checking models: {}", res.status()));
    }

    let tags: OllamaTagsResponse = res.json().await
        .map_err(|e| format!("Failed to parse Ollama tags: {}", e))?;

    // Preference order: specific latest -> 7b -> any qwen2.5-coder -> fail
    let all_models: Vec<String> = tags.models.into_iter().map(|m| m.name).collect();

    if all_models.contains(&"qwen2.5-coder:latest".to_string()) {
        return Ok("qwen2.5-coder:latest".to_string());
    }

    // Check for any qwen2.5-coder (e.g. "qwen2.5-coder:7b", "qwen2.5-coder:1.5b")
    if let Some(found) = all_models.iter().find(|m| m.contains("qwen2.5-coder")) {
        return Ok(found.clone());
    }

    // Fallback or error
    Err("Model 'qwen2.5-coder' (or variant) not found. Please run 'ollama pull qwen2.5-coder'.".to_string())
}

#[tauri::command]
pub async fn check_ai_status() -> Result<AiStatus, String> {
    match resolve_model_name().await {
        Ok(name) => {
            Ok(AiStatus {
                online: true,
                model_loaded: true,
                message: format!("Local • Ready ({})", name.replace("qwen2.5-coder:", ""))
            })
        },
        Err(e) => {
             // If we can't connect, it's offline. If we can connect but no model, it's online but no model.
             if e.contains("Failed to connect") {
                Ok(AiStatus {
                    online: false,
                    model_loaded: false,
                    message: format!("Ollama offline: {}", e)
                })
             } else {
                 Ok(AiStatus {
                    online: true,
                    model_loaded: false,
                    message: e
                })
             }
        }
    }
}

#[tauri::command]
pub async fn ask_copilot(
    state: State<'_, DbState>,
    user_prompt: String,
) -> Result<AiResponse, String> {
    const MAX_RETRIES: u8 = 2;
    
    // Resolve model dynamically
    let model_name = resolve_model_name().await?;

    // 1. Get Schema Context
    let (schema, db_type) = {
        let guard = state.adapter.lock().await;
        let adapter = guard.as_ref().ok_or("No active database connection")?;
        let db_name = adapter.get_current_database().await
            .map_err(|_| "Could not determine current database.")?;
        
        let s = adapter.extract_schema(&db_name).await
            .map_err(|e| format!("Failed to extract schema for context: {}", e))?;
            
        let config = adapter.get_connection_config();
        let type_str = match config.db_type {
            crate::adapter::ConnectionType::MySQL => "mysql",
            crate::adapter::ConnectionType::PostgreSQL => "postgresql",
            crate::adapter::ConnectionType::SQLite => "sqlite",
            crate::adapter::ConnectionType::Csv => "sqlite", 
        };
        (s, type_str.to_string())
    };

    // 2. Build Prompt
    let schema_context = build_schema_context(&schema, &db_type);
    let full_system_prompt = format!("{}\n\n{}", SYSTEM_PROMPT, schema_context);

    // 3. Loop for Retries
    let mut last_error = String::new();
    
    for attempt in 0..=MAX_RETRIES {
        let current_prompt = if attempt == 0 {
            user_prompt.clone()
        } else {
            // On retry, inject the error message to guide the model
            format!("{}\n\nSYSTEM: Your previous response was invalid. Error: {}. \n\nREMINDER: You are strictly limited to the provided schema. Do not invent tables.", user_prompt, last_error)
        };

        match query_ollama(full_system_prompt.clone(), current_prompt, model_name.clone()).await {
            Ok(mut response) => {
                // VALIDATION STEP
                if let Err(val_err) = validate_ai_response(&mut response, &schema, &db_type) {
                     last_error = val_err;
                     continue; // Retry
                }
                
                return Ok(response);
            },
            Err(e) => {
                last_error = e;
                if last_error.contains("Failed to connect") {
                    return Err(last_error);
                }
            }
        }
    }

    Err(format!("AI failed after retries. Last error: {}", last_error))
}

// -----------------------------------------------------------------------------
// 7. Sidecar Lifecycle Management
// -----------------------------------------------------------------------------

use std::sync::atomic::{AtomicBool, Ordering};
use tauri_plugin_shell::ShellExt;
// use tauri_plugin_shell::process::CommandEvent;

static OLLAMA_RUNNING: AtomicBool = AtomicBool::new(false);

pub fn start_ollama(app: &tauri::AppHandle) {
    if OLLAMA_RUNNING.load(Ordering::Relaxed) {
        println!("Ollama sidecar already marked as running.");
        return;
    }

    println!("Starting Ollama sidecar...");
    
    // Check if running first? 
    // Usually sidecar logic handles this or we can do a port check.
    // For now we just attempt spawn.
    
    let sidecar = app.shell().sidecar("ollama").unwrap();
    let (_rx, _child) = sidecar
        .args(["serve"])
        .spawn()
        .expect("Failed to spawn ollama sidecar");
        
    OLLAMA_RUNNING.store(true, Ordering::Relaxed);
    
    // Spawn a task to monitor if needed
    tauri::async_runtime::spawn(async move {
        // monitor_ollama(_rx).await; 
    });
}

pub fn stop_ollama(_app: &tauri::AppHandle) {
    // If we were tracking the child process handle (CommandChild), we could kill it here.
    // However, Tauri sidecars usually close with the main app. 
    // If explicit kill is needed, we'd need to store the child handle in State.
    // For now, we trust the sidecar behavior on exit, but we could add explicit kill logic later.
    println!("Stopping Ollama sidecar (relying on parent exit for now)...");
    OLLAMA_RUNNING.store(false, Ordering::Relaxed);
}
