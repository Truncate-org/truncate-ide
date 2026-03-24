use serde::{Deserialize, Serialize};
use crate::adapter::{DatabaseAdapter, ConnectionType};
use crate::types::QueryResult;

#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnProfile {
    pub name: String,
    pub total_rows: i64,
    pub null_count: i64,
    pub null_percentage: f64,
    pub distinct_count: i64,
    pub inferred_type: String,
    pub min: Option<String>,
    pub max: Option<String>,
    pub mean: Option<f64>,
    pub std_dev: Option<f64>,
    pub outliers_count: i64, // Z-Score > 3 or IQR based
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableProfile {
    pub table_name: String,
    pub row_count: i64,
    pub columns: Vec<ColumnProfile>,
    pub duplicates_count: i64, // Exact row duplicates
}

pub async fn profile_table(adapter: &impl DatabaseAdapter, table: &str) -> Result<TableProfile, String> {
    let db_type = adapter.get_connection_config().db_type;
    let q = match db_type {
        ConnectionType::MySQL => '`',
        _ => '"',
    };
    let real_type = match db_type {
        ConnectionType::MySQL => "DOUBLE",
        _ => "REAL",
    };

    // 1. Get Schema / Columns
    let preview = adapter.preview_table(table).await?; 
    let col_names: Vec<String> = preview.columns.iter().map(|c| c.name.clone()).collect();
    
    // 2. Count Total Rows
    let count_query = format!("SELECT COUNT(*) FROM {q}{table}{q}");
    let count_res = adapter.execute_query(&count_query).await?;
    let total_rows = if let QueryResult::ResultSet(rs) = count_res {
        rs.rows.first().and_then(|r| r.first()).and_then(|v| v.parse::<i64>().ok()).unwrap_or(0)
    } else { 0 };

    let mut columns_profile = Vec::new();

    // 3. Profile Each Column
    for col in &col_names {
        // Null Analysis
        let null_query = format!(
            "SELECT COUNT(*) FROM {q}{table}{q} WHERE {q}{col}{q} IS NULL OR {q}{col}{q} = ''", 
            table = table, col = col, q = q
        );
        let null_res = adapter.execute_query(&null_query).await?;
        let null_count = if let QueryResult::ResultSet(rs) = null_res {
            rs.rows.first().and_then(|r| r.first()).and_then(|v| v.parse::<i64>().ok()).unwrap_or(0)
        } else { 0 };

        let null_percentage = if total_rows > 0 {
            (null_count as f64 / total_rows as f64) * 100.0
        } else { 0.0 };

        // Distinct / Unique
        let distinct_query = format!("SELECT COUNT(DISTINCT {q}{col}{q}) FROM {q}{table}{q}", q = q, col = col, table = table);
        let distinct_res = adapter.execute_query(&distinct_query).await?;
        let distinct_count = if let QueryResult::ResultSet(rs) = distinct_res {
            rs.rows.first().and_then(|r| r.first()).and_then(|v| v.parse::<i64>().ok()).unwrap_or(0)
        } else { 0 };

        // Numeric Stats & Outlier Analysis
        let stats_query = format!(
            "SELECT COUNT(*), MIN(CAST({q}{col}{q} as {rt})), MAX(CAST({q}{col}{q} as {rt})), AVG(CAST({q}{col}{q} as {rt})), AVG(CAST({q}{col}{q} as {rt}) * CAST({q}{col}{q} as {rt})) \
             FROM {q}{table}{q} WHERE {q}{col}{q} IS NOT NULL AND {q}{col}{q} != ''", 
            col = col, q = q, rt = real_type, table = table
        );

        let mut min_val: Option<String> = None;
        let mut max_val: Option<String> = None;
        let mut mean_val: Option<f64> = None;
        let mut std_dev_val: Option<f64> = None;
        let mut outliers_count = 0;
        let mut inferred_type = "TEXT".to_string();

        if let Ok(QueryResult::ResultSet(rs)) = adapter.execute_query(&stats_query).await {
             if let Some(row) = rs.rows.first() {
                 let count_num: i64 = row.first().and_then(|v| v.parse().ok()).unwrap_or(0);
                 
                 if count_num > 0 {
                     min_val = row.get(1).cloned();
                     max_val = row.get(2).cloned();
                     let avg: f64 = row.get(3).and_then(|v| v.parse().ok()).unwrap_or(0.0);
                     let avg_sq: f64 = row.get(4).and_then(|v| v.parse().ok()).unwrap_or(0.0);
                     
                     let variance = avg_sq - (avg * avg);
                     let std_dev = if variance > 0.0 { variance.sqrt() } else { 0.0 };
                     
                     mean_val = Some(avg);
                     std_dev_val = Some(std_dev);
                     
                     if std_dev > 0.0 {
                         let outlier_query = format!(
                             "SELECT COUNT(*) FROM {q}{table}{q} WHERE ABS(CAST({q}{col}{q} as {rt}) - {}) > {}",
                             avg, 3.0 * std_dev, q = q, table = table, col = col, rt = real_type
                         );
                         if let Ok(QueryResult::ResultSet(ors)) = adapter.execute_query(&outlier_query).await {
                             outliers_count = ors.rows.first().and_then(|r| r.first())
                                  .and_then(|v| v.parse().ok()).unwrap_or(0);
                         }
                     }
                     
                     inferred_type = "NUMERIC".to_string(); 
                 }
             }
        }
        
        columns_profile.push(ColumnProfile {
            name: col.clone(),
            total_rows,
            null_count,
            null_percentage,
            distinct_count,
            inferred_type, 
            min: min_val,
            max: max_val,
            mean: mean_val,
            std_dev: std_dev_val,
            outliers_count,
        });
    }

    // 4. Duplicate Check
    let distinct_rows_query = format!("SELECT COUNT(*) FROM (SELECT DISTINCT * FROM {q}{table}{q}) as sub", q = q, table = table);
    let mut duplicates_count = 0;
    
    if let Ok(QueryResult::ResultSet(rs)) = adapter.execute_query(&distinct_rows_query).await {
        let distinct_rows: i64 = rs.rows.first().and_then(|r| r.first()).and_then(|v| v.parse().ok()).unwrap_or(0);
        if total_rows > distinct_rows {
            duplicates_count = total_rows - distinct_rows;
        }
    }

    Ok(TableProfile {
        table_name: table.to_string(),
        row_count: total_rows,
        columns: columns_profile,
        duplicates_count,
    })
}
