
#[derive(Debug, PartialEq)]
pub enum SqlType {
    Select,
    Show,
    Describe,
    Use,
    Update,
    Delete,
    Drop,
    Truncate,
    Insert,
    Alter,
    Create,
    Other,
}

pub fn get_sql_type(sql: &str) -> SqlType {
    let trimmed = sql.trim().to_uppercase();
    
    if trimmed.starts_with("SELECT") {
        return SqlType::Select;
    } else if trimmed.starts_with("SHOW") {
        return SqlType::Show;
    } else if trimmed.starts_with("DESCRIBE") || trimmed.starts_with("DESC") {
        return SqlType::Describe;
    } else if trimmed.starts_with("USE") {
        return SqlType::Use;
    } else if trimmed.starts_with("UPDATE") {
        return SqlType::Update;
    } else if trimmed.starts_with("DELETE") {
        return SqlType::Delete;
    } else if trimmed.starts_with("DROP") {
        return SqlType::Drop;
    } else if trimmed.starts_with("TRUNCATE") {
        return SqlType::Truncate;
    } else if trimmed.starts_with("INSERT") {
        return SqlType::Insert;
    } else if trimmed.starts_with("ALTER") {
        return SqlType::Alter;
    } else if trimmed.starts_with("CREATE") {
        return SqlType::Create;
    }
    
    SqlType::Other
}

pub fn extract_db_name(sql: &str) -> Option<String> {
    let trimmed = sql.trim();
    if !trimmed.to_uppercase().starts_with("USE") {
        return None;
    }

    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    if parts.len() < 2 {
        return None;
    }

    // parts[1] is the db name, but might have semicolon
    let mut db_name = parts[1].to_string();
    
    if db_name.ends_with(';') {
        db_name.pop();
    }
    
    // Remove quotes if present (backticks or single/double quotes)
    db_name = db_name.replace('`', "").replace('\'', "").replace('"', "");

    if db_name.is_empty() {
        None
    } else {
        Some(db_name)
    }
}

pub fn is_safe_for_mvp(sql_type: &SqlType) -> bool {
    match sql_type {
        SqlType::Select | SqlType::Show | SqlType::Describe | SqlType::Use | SqlType::Create | SqlType::Drop | SqlType::Alter => true,
        _ => false,
    }
}

pub fn has_limit_clause(sql: &str) -> bool {
    let normalized = sql.replace('\n', " ").replace('\r', " ");
    let upper = normalized.to_uppercase();
    upper.split_whitespace().any(|word| word == "LIMIT")
}

pub fn validate_sql_structure(sql: &str, sql_type: &SqlType) -> Result<(), String> {
    if matches!(sql_type, SqlType::Select) {
        let normalized = sql.replace('\n', " ").replace('\r', " ");
        let upper = normalized.to_uppercase();
        
        // Simple check for FROM clause
        // Split by whitespace to ensure whole word matching
        let has_from = upper.split_whitespace().any(|word| word == "FROM");
        
        if !has_from {
            return Err("Invalid SQL: SELECT statements must include a FROM clause.".to_string());
        }
    }
    Ok(())
}

/// Splits the SQL string by semicolons and returns the last non-empty statement.
/// This ensures we only execute one statement at a time, similar to a terminal default behavior.
pub fn get_last_statement(sql: &str) -> Option<String> {
    sql.split(';')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .last()
        .map(|s| s.to_string())
}
