use std::process::{Command, Stdio};
use std::io::Write;

use super::types::Plan;

const MODEL: &str = "qwen2.5:7b";

fn run_ollama(prompt: &str) -> Result<String, String> {
    let mut child = Command::new("ollama")
        .args(["run", MODEL])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start ollama: {}", e))?;

    {
        let stdin = child.stdin.as_mut().ok_or("Failed to open stdin")?;
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|e| format!("Failed to write to ollama stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to read ollama output: {}", e))?;

    String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 from ollama: {}", e))
}

fn load_prompt(path: &str) -> Result<String, String> {
    std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to load prompt {}: {}", path, e))
}

pub fn generate_plan_with_review(
    question: &str,
    max_retries: usize,
) -> Result<Plan, String> {
    let planner_prompt =
        load_prompt("src-tauri/src/ai/prompts/planner.txt")?;
    let critic_prompt =
        load_prompt("src-tauri/src/ai/prompts/critic.txt")?;

    for attempt in 1..=max_retries {
        // ---- PLANNER ----
        let full_planner_prompt = format!(
            "{}\n\nQuestion:\n{}\n",
            planner_prompt, question
        );

        let planner_output = run_ollama(&full_planner_prompt)?;

        let plan: Plan = match serde_json::from_str(&planner_output) {
            Ok(p) => p,
            Err(_) => {
                // invalid JSON → retry
                continue;
            }
        };

        // ---- CRITIC ----
        let full_critic_prompt = format!(
            "{}\n\nPlan:\n{}\n",
            critic_prompt,
            serde_json::to_string_pretty(&plan).unwrap()
        );

        let verdict = run_ollama(&full_critic_prompt)?
            .trim()
            .to_string();

        if verdict == "APPROVED" {
            return Ok(plan);
        }

        // otherwise: REWRITE → loop again
        eprintln!("AI planner retrying (attempt {})", attempt);
    }

    Err("AI planner failed to produce an approved plan".into())
}
