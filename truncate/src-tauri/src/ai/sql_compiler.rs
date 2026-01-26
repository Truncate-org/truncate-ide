use super::types::Plan;

pub fn compile_plan_to_sql(plan: &Plan) -> Result<String, String> {
    // Very first deterministic compiler: pattern-based
    let steps = &plan.steps;

    let mut sql = String::from(
        "SELECT customer_id, SUM(amount) AS total_spending \
         FROM orders "
    );

    for step in steps {
        if step.to_lowercase().contains("last year") {
            sql.push_str("WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR) ");
        }
    }

    sql.push_str(
        "GROUP BY customer_id \
         ORDER BY total_spending DESC \
         LIMIT 5;"
    );

    Ok(sql)
}
