pub mod loop;
pub mod types;

pub fn plan_query(question: &str) -> Result<types::Plan, String> {
    loop::generate_plan_with_review(question, 3)
}
