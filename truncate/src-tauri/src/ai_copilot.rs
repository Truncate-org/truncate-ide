use tauri::State;
use serde::{Deserialize, Serialize};
use crate::db_state::DbState;
use crate::schema::Schema;
use crate::adapter::DatabaseAdapter;
use std::collections::HashMap;

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
    pub intent: String, // "query" | "explain" | "error"
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

const SYSTEM_PROMPT_TEMPLATE: &str = r#"You are a local database assistant embedded inside a developer IDE.

Your role:
- Help users understand database schemas
- Generate SQL queries
- Explain SQL queries
- Fix SQL queries using database error messages

Strict rules (MANDATORY):
- You are NOT a general chatbot.
- You must ONLY use the database schema explicitly provided to you.
- You are FORBIDDEN from inventing tables, columns, relationships, or data.
- You are FORBIDDEN from guessing or assuming schema details.
- If the schema does not contain enough information, you MUST respond with:
  "I don’t have enough information from the database schema to answer this."

SQL rules:
- Generate SQL only for the given database dialect.
- Never use tables or columns not present in the schema.
- Prefer safe, read-only queries by default.

Output rules:
- You MUST respond in valid JSON only.
- Do NOT include markdown.
- Do NOT include explanations outside JSON.
- If you are unsure, clearly state uncertainty in the response.

Failure to follow these rules is considered an incorrect response.
"#;

const OUTPUT_SCHEMA_INSTRUCTION: &str = r#"
You must enforce this output format:
{
  "intent": "query | explain | error",
  "sql": "SQL STRING OR EMPTY",
  "explanation": "SHORT EXPLANATION OR EMPTY",
  "confidence": "high | low"
}
"#;

// -----------------------------------------------------------------------------
// 3. Schema Injection & Prompt Construction
// -----------------------------------------------------------------------------

fn build_schema_context(schema: &Schema, db_type: &str) -> String {
    let mut context = String::new();
    context.push_str(&format!("Database Engine: {}\n", db_type));
    context.push_str(&format!("Active Database: {}\n\n", schema.database_name));
    context.push_str("Database Schema:\n");

    for table in &schema.tables {
        context.push_str(&format!("{}\n", table.name));
        for col in &table.columns {
            context.push_str(&format!("  - {} ({})\n", col.name, col.data_type));
        }
        context.push('\n');
    }

    context.push_str("Constraints:\n");
    context.push_str("- Use ONLY the schema above.\n");
    context.push_str("- If a table or column is missing, you must say you cannot answer.\n");
    
    context
}

fn validate_sql_safety(sql: &str) -> bool {
    let upper = sql.to_uppercase();
    // Basic Keyword Check for destructive operations
    // This is a safety net; the prompt also discourages it.
    !upper.contains("DROP ") && 
    !upper.contains("DELETE ") && 
    !upper.contains("UPDATE ") && 
    !upper.contains("ALTER ") && 
    !upper.contains("TRUNCATE ")
}

// -----------------------------------------------------------------------------
// 4. Ollama Communication
// -----------------------------------------------------------------------------

async fn query_ollama(system_msg: String, user_msg: String, model: String) -> Result<AiResponse, String> {
    let client = reqwest::Client::new();
    let url = "http://localhost:11434/api/chat";

    // Configure model parameters for deterministic output
    let mut options = HashMap::new();
    options.insert("temperature".to_string(), serde_json::json!(0.15));
    options.insert("top_p".to_string(), serde_json::json!(0.9));
    options.insert("max_tokens".to_string(), serde_json::json!(1024)); // Increased for complex queries
    options.insert("repeat_penalty".to_string(), serde_json::json!(1.1));

    let messages = vec![
        Message { role: "system".to_string(), content: system_msg },
        Message { role: "user".to_string(), content: user_msg },
    ];

    let request = OllamaRequest {
        model: model.clone(),
        messages,
        stream: false,
        options,
    };

    let res = client.post(url)
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama (Is it running?): {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Ollama API Error: {}", res.status()));
    }

    let ollama_res: OllamaResponse = res.json().await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    let raw_content = ollama_res.message.content;

    // Attempt to parse internal JSON
    match serde_json::from_str::<AiResponse>(&raw_content) {
        Ok(mut parsed) => {
            parsed.is_safe = validate_sql_safety(&parsed.sql);
            Ok(parsed)
        },
        Err(_) => {
            // Failure handling: Attempt to strip markdown code blocks if present
            let cleaned = raw_content.trim()
                .trim_start_matches("```json")
                .trim_start_matches("```")
                .trim_end_matches("```")
                .trim();
                
             let mut parsed = serde_json::from_str::<AiResponse>(cleaned)
                .map_err(|e| format!("Model returned invalid JSON: {}. Raw: {}", e, raw_content))?;
             
             parsed.is_safe = validate_sql_safety(&parsed.sql);
             Ok(parsed)
        }
    }
}

// -----------------------------------------------------------------------------
// 5. Main Command Handler
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn check_ai_status() -> Result<AiStatus, String> {
    let client = reqwest::Client::new();
    let url = "http://localhost:11434/api/tags";

    match client.get(url).send().await {
        Ok(res) => {
            if res.status().is_success() {
                // Check if our model is present
                // Response format: {"models": [{"name": "qwen2.5-coder:latest", ...}]}
                #[derive(Deserialize)]
                struct Model { name: String }
                #[derive(Deserialize)]
                struct TagsResponse { models: Vec<Model> }

                let tags: TagsResponse = res.json().await.map_err(|e| e.to_string())?;
                let has_model = tags.models.iter().any(|m| m.name.contains("qwen2.5-coder"));

                Ok(AiStatus {
                    online: true,
                    model_loaded: has_model,
                    message: if has_model { "Ready".to_string() } else { "Model 'qwen2.5-coder' not found. Run 'ollama pull qwen2.5-coder'.".to_string() }
                })
            } else {
                Ok(AiStatus {
                    online: true,
                    model_loaded: false,
                    message: format!("Ollama running but returned error: {}", res.status())
                })
            }
        },
        Err(e) => {
             Ok(AiStatus {
                online: false,
                model_loaded: false,
                message: format!("Ollama offline: {}", e)
            })
        }
    }
}

#[tauri::command]
pub async fn ask_copilot(
    state: State<'_, DbState>,
    user_prompt: String,
) -> Result<AiResponse, String> {
    const MAX_RETRIES: u8 = 2;
    const MODEL_NAME: &str = "qwen2.5-coder:latest";

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
    let full_system_prompt = format!("{}\n\n{}\n\n{}", SYSTEM_PROMPT_TEMPLATE, schema_context, OUTPUT_SCHEMA_INSTRUCTION);

    // 3. Loop for Retries
    let mut last_error = String::new();
    
    for attempt in 0..=MAX_RETRIES {
        let current_prompt = if attempt == 0 {
            user_prompt.clone()
        } else {
            // On retry, inject the error message to guide the model
            format!("{}\n\nSYSTEM: Your previous response was invalid. Error: {}. Fix the JSON and try again.", user_prompt, last_error)
        };

        match query_ollama(full_system_prompt.clone(), current_prompt, MODEL_NAME.to_string()).await {
            Ok(response) => {
                if response.intent == "error" && !response.sql.is_empty() {
                     return Ok(AiResponse { sql: "".to_string(), ..response });
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
