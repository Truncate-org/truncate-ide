use serde::Serialize;
use sqlparser::ast::Statement;

#[derive(Debug, Serialize, Clone)]
pub enum Severity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Serialize, Clone)]
pub struct AnalysisResult {
    pub rule_name: String,
    pub message: String,
    pub severity: Severity,
}

#[derive(Debug, Serialize, Clone)]
pub struct RuleExplanation {
    pub name: String,
    pub description: String,
    pub fix_strategy: String,
}

pub trait AnalyzerRule: Send + Sync {
    /// Returns the unique name of the rule.
    fn name(&self) -> &str;

    /// Returns a human-readable explanation of the rule,
    /// why it fails, and how it is fixed.
    fn explain(&self) -> RuleExplanation;

    /// Executes a read-only pass over the AST.
    /// Returns a list of analysis constraints that were broken.
    fn analyze(&self, statements: &[Statement]) -> Vec<AnalysisResult>;

    /// Modifies the AST directly to enforce the rule automatically.
    /// Expected to return `true` if any modifications were made to the statements.
    fn auto_fix(&self, statements: &mut Vec<Statement>) -> bool;
}
