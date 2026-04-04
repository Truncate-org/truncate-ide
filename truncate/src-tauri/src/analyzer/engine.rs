use crate::analyzer::rules::{DestructiveStatementWarning, EnforceSmartLimit};
use crate::analyzer::types::{AnalysisResult, AnalyzerRule, RuleExplanation};
use crate::error::TruncateError;
use sqlparser::dialect::GenericDialect;
use sqlparser::parser::Parser;

pub struct SqlAnalyzer {
    rules: Vec<Box<dyn AnalyzerRule>>,
}

impl SqlAnalyzer {
    /// Initializes the SQL Analyzer with a strict set of pre-registered rules.
    pub fn new() -> Self {
        Self {
            rules: vec![
                Box::new(DestructiveStatementWarning),
                Box::new(EnforceSmartLimit),
            ],
        }
    }

    /// Extends the rule engine dynamically if needed.
    pub fn add_rule(&mut self, rule: Box<dyn AnalyzerRule>) {
        self.rules.push(rule);
    }

    /// Parses the SQL and executes a read-only analysis constraint check.
    pub fn analyze(&self, sql: &str) -> Vec<AnalysisResult> {
        let mut all_results = Vec::new();

        let dialect = GenericDialect {};
        let ast = match Parser::parse_sql(&dialect, sql) {
            Ok(ast) => ast,
            Err(_) => return all_results, // If parser fails, return empty bounds
        };

        for rule in &self.rules {
            let results = rule.analyze(&ast);
            all_results.extend(results);
        }

        all_results
    }

    /// Runs all `auto_fix` mutating logic over the raw AST and returns the stitched SQL string.
    pub fn auto_fix(&self, sql: &str) -> Result<String, TruncateError> {
        let dialect = GenericDialect {};
        let mut ast =
            Parser::parse_sql(&dialect, sql).map_err(|e| TruncateError::InternalError {
                message: format!("Failed to parse SQL for auto-fix: {}", e),
            })?;

        let mut was_modified = false;

        for rule in &self.rules {
            if rule.auto_fix(&mut ast) {
                was_modified = true;
            }
        }

        if was_modified {
            // Join parsed modified AST back to String
            let formatted_sql = ast
                .iter()
                .map(|stmt| stmt.to_string())
                .collect::<Vec<String>>()
                .join(";\n")
                // Adding a trailing semicolon for valid block termination
                + ";";

            Ok(formatted_sql)
        } else {
            Ok(sql.to_string())
        }
    }

    /// Retrieves the structural explanation of any registered rule.
    pub fn explain_rule(&self, name: &str) -> Option<RuleExplanation> {
        self.rules
            .iter()
            .find(|r| r.name() == name)
            .map(|r| r.explain())
    }
}
