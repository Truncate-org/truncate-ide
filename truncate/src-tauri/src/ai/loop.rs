use super::types::Plan;

pub fn generate_plan_with_review(
    _question: &str,
    _max_retries: usize,
) -> Result<Plan, String> {
    Err("AI planner loop not implemented yet".into())
}
