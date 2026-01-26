use std::process::{Command, Stdio};
use std::io::Write;

pub fn derive_assumptions(question: &str) -> Result<String, String> {
    let prompt = include_str!("prompts/assumptions.txt");

    let full_prompt = format!(
        "{}\n\nQUESTION:\n{}\n\nJSON:",
        prompt,
        question
    );

    let mut child = Command::new("ollama")
        .args(["run", "qwen2.5:7b"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    child.stdin
        .as_mut()
        .ok_or("Failed to open stdin")?
        .write_all(full_prompt.as_bytes())
        .map_err(|e| e.to_string())?;

    let output = child.wait_with_output().map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
