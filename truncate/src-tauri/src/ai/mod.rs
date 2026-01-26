pub mod planner_loop;
pub mod types;
pub mod sql_compiler;
pub mod assumptions;

#[cfg(test)]
mod tests;



pub fn plan_query(question: &str) -> Result<types::Plan, String> {
    planner_loop::generate_plan_with_review(question, 3)
}

