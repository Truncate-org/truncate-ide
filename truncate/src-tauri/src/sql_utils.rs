use sqlparser::dialect::{GenericDialect, MySqlDialect};
use sqlparser::parser::Parser;
use sqlparser::ast::Statement;

#[derive(Debug, PartialEq)]
pub enum SqlType {
    Select,
    Create,
    Drop,
    Alter,
    Insert,
    Update,
    Delete,
    Use, // Added
    Other,
}

pub fn get_last_statement(sql: &str) -> Option<String> {
    let trimmed = sql.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Try MySQL dialect first (handles backticks), then Generic
    let dialects: Vec<Box<dyn sqlparser::dialect::Dialect>> = vec![
        Box::new(MySqlDialect {}),
        Box::new(GenericDialect {}),
    ];

    for dialect in &dialects {
        if let Ok(ast) = Parser::parse_sql(dialect.as_ref(), trimmed) {
            if !ast.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    // Fallback: if the SQL starts with a known keyword, return it as-is
    // This handles edge cases where neither dialect can parse but the SQL is valid
    let upper = trimmed.to_uppercase();
    if upper.starts_with("SELECT ") || upper.starts_with("CREATE ") ||
       upper.starts_with("INSERT ") || upper.starts_with("UPDATE ") ||
       upper.starts_with("DELETE ") || upper.starts_with("DROP ") ||
       upper.starts_with("ALTER ") || upper.starts_with("USE ") ||
       upper.starts_with("SHOW ")
    {
        return Some(trimmed.to_string());
    }

    None
}

pub fn get_sql_type(sql: &str) -> SqlType {
    // Check for USE manually as it's often not in generic dialect
    let trimmed = sql.trim();
    if trimmed.to_uppercase().starts_with("USE ") {
        return SqlType::Use;
    }

    // Try MySQL dialect first, then Generic
    let dialects: Vec<Box<dyn sqlparser::dialect::Dialect>> = vec![
        Box::new(MySqlDialect {}),
        Box::new(GenericDialect {}),
    ];

    for dialect in &dialects {
        if let Ok(ast) = Parser::parse_sql(dialect.as_ref(), sql) {
            if let Some(stmt) = ast.last() {
                return match stmt {
                    Statement::Query(_) => SqlType::Select,
                    Statement::CreateTable { .. } => SqlType::Create,
                    Statement::CreateDatabase { .. } => SqlType::Create,
                    Statement::Drop { .. } => SqlType::Drop,
                    Statement::AlterTable { .. } => SqlType::Alter,
                    Statement::Insert { .. } => SqlType::Insert,
                    Statement::Update { .. } => SqlType::Update,
                    Statement::Delete { .. } => SqlType::Delete,
                    _ => SqlType::Other,
                };
            }
        }
    }

    // Keyword-based fallback
    let upper = trimmed.to_uppercase();
    if upper.starts_with("SELECT ") { SqlType::Select }
    else if upper.starts_with("CREATE ") { SqlType::Create }
    else if upper.starts_with("DROP ") { SqlType::Drop }
    else if upper.starts_with("ALTER ") { SqlType::Alter }
    else if upper.starts_with("INSERT ") { SqlType::Insert }
    else if upper.starts_with("UPDATE ") { SqlType::Update }
    else if upper.starts_with("DELETE ") { SqlType::Delete }
    else { SqlType::Other }
}

pub fn is_safe_for_mvp(sql_type: &SqlType) -> bool {
    match sql_type {
        // Allow all standard SQL operations for the IDE functionality
        SqlType::Select | 
        SqlType::Use | 
        SqlType::Create | 
        SqlType::Drop | 
        SqlType::Alter | 
        SqlType::Insert | 
        SqlType::Update | 
        SqlType::Delete | 
        SqlType::Other => true,
    }
}

pub fn has_limit_clause(sql: &str) -> bool {
    sql.to_uppercase().contains("LIMIT")
}

pub fn validate_sql_structure(sql: &str, _type: &SqlType) -> Result<(), String> {
    if sql.trim().is_empty() {
        return Err("Empty SQL query".to_string());
    }
    Ok(())
}

// Dummy extraction if needed, or we just remove import usage
pub fn extract_db_name(_sql: &str) -> Option<String> {
    None
}

pub fn format_table(columns: &[String], rows: &[Vec<String>]) -> String {
    if columns.is_empty() {
        return "\nEmpty Result\n".to_string();
    }

    // 1. Calculate Widths
    let mut widths: Vec<usize> = columns.iter().map(|c| c.len()).collect();
    
    // Max width per column to prevent terminal explosion, say 50?
    // And scan rows
    // Limited to 50 rows for formatter to match the previous logic? 
    // Or format ALL rows? Terminal paging usually handles it, but massive string is bad.
    // Let's limit scan to 100 rows for width calc, and display maybe 100 rows?
    
    let display_rows = if rows.len() > 100 { &rows[0..100] } else { rows };
    
    for row in display_rows {
        for (i, cell) in row.iter().enumerate() {
            if i < widths.len() {
                let len = cell.len();
                if len > widths[i] {
                    widths[i] = if len > 50 { 50 } else { len };
                }
            }
        }
    }

    // 2. Build Separator
    // +------+-------+
    let mut separator = String::new();
    separator.push('+');
    for w in &widths {
        separator.push_str(&"-".repeat(*w + 2));
        separator.push('+');
    }
    
    let mut output = String::new();
    output.push_str("\r\n"); // Start with newline
    output.push_str(&separator);
    output.push_str("\r\n");

    // 3. Header
    output.push('|');
    for (i, col) in columns.iter().enumerate() {
        output.push(' ');
        output.push_str(&format!("{:<width$}", col, width = widths[i]));
        output.push(' ');
        output.push('|');
    }
    output.push_str("\r\n");
    output.push_str(&separator);
    output.push_str("\r\n");

    // 4. Rows
    for row in display_rows {
        output.push('|');
        for (i, cell) in row.iter().enumerate() {
            if i < widths.len() {
                output.push(' ');
                let content = if cell.len() > widths[i] {
                     // Truncate
                     format!("{}...", &cell[0..widths[i]-3])
                } else {
                    cell.clone()
                };
                output.push_str(&format!("{:<width$}", content, width = widths[i]));
                output.push(' ');
                output.push('|');
            }
        }
        output.push_str("\r\n");
    }

    output.push_str(&separator);
    output.push_str("\r\n");
    
    if rows.len() > display_rows.len() {
        output.push_str(&format!("\x1b[90m... and {} more rows (view in Preview Panel)\x1b[0m\r\n", rows.len() - display_rows.len()));
    }
    output.push_str(&format!("\x1b[90m{} rows in set\x1b[0m\r\n", rows.len()));

    output
}
