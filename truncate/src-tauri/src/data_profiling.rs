use serde::{Deserialize, Serialize};
use crate::adapter::DatabaseAdapter;
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
    // 1. Get Schema / Columns
    // Actually adapter.list_columns is better if available, but QueryResult from select works
    let preview = adapter.preview_table(table).await?; 
    let col_names: Vec<String> = preview.columns.iter().map(|c| c.name.clone()).collect();
    
    // 2. Count Total Rows
    let count_query = format!("SELECT COUNT(*) FROM {}", table);
    let count_res = adapter.execute_query(&count_query).await?;
    let total_rows = if let QueryResult::ResultSet(rs) = count_res {
        rs.rows.first().and_then(|r| r.first()).and_then(|v| v.parse::<i64>().ok()).unwrap_or(0)
    } else { 0 };

    let mut columns_profile = Vec::new();

    // 3. Profile Each Column
    for col in &col_names {
        // Null Analysis
        let null_query = format!(
            "SELECT COUNT(*) FROM {} WHERE \"{}\" IS NULL OR \"{}\" = ''", 
            table, col, col
        );
        let null_res = adapter.execute_query(&null_query).await?;
        let null_count = if let QueryResult::ResultSet(rs) = null_res {
            rs.rows.first().and_then(|r| r.first()).and_then(|v| v.parse::<i64>().ok()).unwrap_or(0)
        } else { 0 };

        let null_percentage = if total_rows > 0 {
            (null_count as f64 / total_rows as f64) * 100.0
        } else { 0.0 };

        // Distinct / Unique
        let distinct_query = format!("SELECT COUNT(DISTINCT \"{}\") FROM {}", col, table);
        let distinct_res = adapter.execute_query(&distinct_query).await?;
        let distinct_count = if let QueryResult::ResultSet(rs) = distinct_res {
            rs.rows.first().and_then(|r| r.first()).and_then(|v| v.parse::<i64>().ok()).unwrap_or(0)
        } else { 0 };

        // Numeric Stats (Min, Max, Avg) - Only attempt if it looks numeric?
        // For RAW staging, everything is TEXT. So we try to cast.
        // SQLite: Cast(col as Real)
        
        // Numeric Stats & Outlier Analysis
        // For SQLite (and others), we can estimate StdDev via Variance = Avg(x^2) - Avg(x)^2
        // We filter for non-null and non-empty values.
        let stats_query = format!(
            "SELECT COUNT(*), MIN(CAST(\"{}\" as REAL)), MAX(CAST(\"{}\" as REAL)), AVG(CAST(\"{}\" as REAL)), AVG(CAST(\"{}\" as REAL) * CAST(\"{}\" as REAL)) \
             FROM {} WHERE \"{}\" IS NOT NULL AND \"{}\" != ''", 
            col, col, col, col, col, table, col, col
        );

        let mut min_val: Option<String> = None;
        let mut max_val: Option<String> = None;
        let mut mean_val: Option<f64> = None;
        let mut std_dev_val: Option<f64> = None;
        let mut outliers_count = 0;
        let mut inferred_type = "TEXT".to_string();

        if let Ok(QueryResult::ResultSet(rs)) = adapter.execute_query(&stats_query).await {
             if let Some(row) = rs.rows.first() {
                 // row: [count, min, max, avg, avg_sq]
                 let count_num: i64 = row.get(0).and_then(|v| v.parse().ok()).unwrap_or(0);
                 
                 // If we have enough numeric values, treat as potential number for outlier check
                 if count_num > 0 {
                     min_val = row.get(1).cloned();
                     max_val = row.get(2).cloned();
                     let avg: f64 = row.get(3).and_then(|v| v.parse().ok()).unwrap_or(0.0);
                     let avg_sq: f64 = row.get(4).and_then(|v| v.parse().ok()).unwrap_or(0.0);
                     
                     let variance = avg_sq - (avg * avg);
                     let std_dev = if variance > 0.0 { variance.sqrt() } else { 0.0 };
                     
                     mean_val = Some(avg);
                     std_dev_val = Some(std_dev);
                     
                     // If StdDev > 0, we can check for outliers (Z-Score > 3)
                     if std_dev > 0.0 {
                         let outlier_query = format!(
                             "SELECT COUNT(*) FROM {} WHERE ABS(CAST(\"{}\" as REAL) - {}) > {}",
                             table, col, avg, 3.0 * std_dev
                         );
                         if let Ok(QueryResult::ResultSet(ors)) = adapter.execute_query(&outlier_query).await {
                             outliers_count = ors.rows.first().and_then(|r| r.first())
                                 .and_then(|v| v.parse().ok()).unwrap_or(0);
                         }
                     }
                     
                     // Simple Type Refinement
                     // If numeric count is close to total non-null count (calculated separately or roughly here), set type
                     // For now, if we got valid stats, let's call it REAL or INTEGER (heuristic)
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
    // Calculate Total Rows vs Count of Distinct Rows
    // Since "DISTINCT *" might be heavy, we can try to construct a query.
    // SQLite: SELECT COUNT(*) FROM (SELECT DISTINCT * FROM table)
    let distinct_rows_query = format!("SELECT COUNT(*) FROM (SELECT DISTINCT * FROM {})", table);
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
