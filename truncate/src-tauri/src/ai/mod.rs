pub mod types;

/// Entry point for AI planning.
/// For now, this is a stub.
pub fn plan_query(_question: &str) -> Result<types::Plan, String> {
    Err("AI planner not implemented yet".into())
}
