use crate::analyzer::types::{AnalysisResult, AnalyzerRule, RuleExplanation, Severity};
use sqlparser::ast::Statement;

/// Rule 1: Destructive Statement Warning (AST Safety Layer)
pub struct DestructiveStatementWarning;

impl AnalyzerRule for DestructiveStatementWarning {
    fn name(&self) -> &str {
        "DestructiveStatementWarning"
    }

    fn explain(&self) -> RuleExplanation {
        RuleExplanation {
            name: self.name().to_string(),
            description: "Detects destructive operations like DROP, TRUNCATE, ALTER, or DELETE without WHERE, requiring explicit user confirmation.".to_string(),
            fix_strategy: "Requires manual review and explicit confirmation before execution.".to_string(),
        }
    }

    fn analyze(&self, statements: &[Statement]) -> Vec<AnalysisResult> {
        let mut results = Vec::new();
        for stmt in statements {
            match stmt {
                Statement::Delete { selection, .. } => {
                    if selection.is_none() {
                        results.push(AnalysisResult {
                            rule_name: self.name().to_string(),
                            message: "A DELETE statement without a WHERE clause will erase all rows in the table.".to_string(),
                            severity: Severity::Error,
                        });
                    }
                }
                Statement::Drop { .. } => {
                    results.push(AnalysisResult {
                        rule_name: self.name().to_string(),
                        message: "A DROP statement will permanently destroy the object and its data.".to_string(),
                        severity: Severity::Error,
                    });
                }
                Statement::Truncate { .. } => {
                    results.push(AnalysisResult {
                        rule_name: self.name().to_string(),
                        message: "A TRUNCATE statement will instantly remove all records from the table.".to_string(),
                        severity: Severity::Error,
                    });
                }
                Statement::AlterTable { .. } | Statement::AlterIndex { .. } | Statement::AlterView { .. } | Statement::AlterRole { .. } => {
                    results.push(AnalysisResult {
                        rule_name: self.name().to_string(),
                        message: "An ALTER statement will modify the structural schema of the database.".to_string(),
                        severity: Severity::Error,
                    });
                }
                _ => {}
            }
        }
        results
    }

    fn auto_fix(&self, _statements: &mut Vec<Statement>) -> bool {
        false
    }
}

/// Rule 2: Ensure SELECTs have a LIMIT safely (Demo mutation)
pub struct EnforceSmartLimit;

impl AnalyzerRule for EnforceSmartLimit {
    fn name(&self) -> &str {
        "EnforceSmartLimit"
    }

    fn explain(&self) -> RuleExplanation {
        RuleExplanation {
            name: self.name().to_string(),
            description: "Ensures that all SELECT operations have a concrete upper boundary.".to_string(),
            fix_strategy: "Appends LIMIT 1000 to the query if no limit is specified.".to_string(),
        }
    }

    fn analyze(&self, statements: &[Statement]) -> Vec<AnalysisResult> {
        let mut results = Vec::new();

        for stmt in statements {
            if let Statement::Query(q) = stmt {
                if q.limit.is_none() {
                    results.push(AnalysisResult {
                        rule_name: self.name().to_string(),
                        message: "Query lacks a LIMIT clause. It may return excessive rows.".to_string(),
                        severity: Severity::Warning,
                    });
                }
            }
        }

        results
    }

    fn auto_fix(&self, statements: &mut Vec<Statement>) -> bool {
        let mut modified = false;

        for stmt in statements.iter_mut() {
            if let Statement::Query(ref mut q) = stmt {
                if q.limit.is_none() {
                    use sqlparser::ast::{Expr, Value};
                    
                    // Simple injection of LIMIT 1000
                    q.limit = Some(Expr::Value(Value::Number("1000".to_string(), false)));
                    modified = true;
                }
            }
        }

        modified
    }
}
