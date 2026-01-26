use std::io::Write;
use std::process::{Command, Stdio};
const PLANNER_PROMPT: &str = include_str!("prompts/planner.txt");
const CRITIC_PROMPT: &str = include_str!("prompts/critic.txt");

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

    String::from_utf8(output.stdout).map_err(|e| format!("Invalid UTF-8 from ollama: {}", e))
}

pub fn generate_plan_with_review(question: &str, max_retries: usize) -> Result<Plan, String> {
    let planner_prompt = PLANNER_PROMPT;
    let critic_prompt = CRITIC_PROMPT;

    for attempt in 1..=max_retries {
        // ---- PLANNER ----
        let full_planner_prompt = format!("{}\n\nQuestion:\n{}\n", planner_prompt, question);

        let planner_output = run_ollama(&full_planner_prompt)?;

        eprintln!("--- PLANNER OUTPUT ---");
        eprintln!("{}", planner_output);

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

        let verdict = run_ollama(&full_critic_prompt)?.trim().to_string();
        eprintln!("--- CRITIC VERDICT ---");
        eprintln!("{}", verdict);

        if verdict == "APPROVED" {
            return Ok(plan);
        }

        // otherwise: REWRITE → loop again
        eprintln!("AI planner retrying (attempt {})", attempt);
    }

    Err("AI planner failed to produce an approved plan".into())
}
