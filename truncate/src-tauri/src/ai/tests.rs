use super::plan_query;

#[test]
fn test_simple_planning() {
    let question = "Top 5 customers by total spending last year";
    let plan = plan_query(question).expect("Planner failed");

    println!("PLAN OUTPUT:");
    for step in plan.steps {
        println!("- {}", step);
    }
}

#[test]
fn test_complex_analytics_planning() {
    let question = "Find customers who churned but influenced others to increase spending";

    let assumptions =
        crate::ai::assumptions::derive_assumptions(question).expect("Assumptions failed");

    println!("ASSUMPTIONS:");
    println!("{}", assumptions);

    let plan = plan_query(&format!("{}\n\nASSUMPTIONS:\n{}", question, assumptions))
        .expect("Planner failed");

    println!("COMPLEX PLAN:");
    for step in plan.steps {
        println!("- {}", step);
    }
}
