use crate::adapter::{ConnectionType, DatabaseAdapter};
use crate::types::QueryResult;
use serde::{Deserialize, Serialize};

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

pub async fn profile_table(
    adapter: &impl DatabaseAdapter,
    table: &str,
) -> Result<TableProfile, String> {
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
        rs.rows
            .first()
            .and_then(|r| r.first())
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(0)
    } else {
        0
    };

    let mut columns_profile = Vec::new();

    // 3. Profile Columns in Batches (e.g., 10 columns at a time)
    // This reduces the number of queries from 800+ to ~40 for 200 columns.
    for chunk in col_names.chunks(10) {
        let mut stats_selects = Vec::new();
        for col in chunk {
            // We calculate:
            // 0: Non-null count
            // 1: Distinct count
            // 2: Min
            // 3: Max
            // 4: Avg
            // 5: Avg of Squares (for Std Dev)
            stats_selects.push(format!(
                "COUNT({q}{col}{q}), COUNT(DISTINCT {q}{col}{q}), MIN(CAST({q}{col}{q} as {rt})), MAX(CAST({q}{col}{q} as {rt})), AVG(CAST({q}{col}{q} as {rt})), AVG(CAST({q}{col}{q} as {rt}) * CAST({q}{col}{q} as {rt}))",
                col = col, q = q, rt = real_type
            ));
        }

        let batch_query = format!("SELECT {} FROM {q}{table}{q}", stats_selects.join(", "));

        if let Ok(QueryResult::ResultSet(rs)) = adapter.execute_query(&batch_query).await {
            if let Some(row) = rs.rows.first() {
                for (i, col) in chunk.iter().enumerate() {
                    let offset = i * 6;

                    let non_null_count: i64 =
                        row.get(offset).and_then(|v| v.parse().ok()).unwrap_or(0);
                    let null_count = total_rows - non_null_count;
                    let null_percentage = if total_rows > 0 {
                        (null_count as f64 / total_rows as f64) * 100.0
                    } else {
                        0.0
                    };

                    let distinct_count: i64 = row
                        .get(offset + 1)
                        .and_then(|v| v.parse().ok())
                        .unwrap_or(0);

                    let min_val = row.get(offset + 2).cloned();
                    let max_val = row.get(offset + 3).cloned();
                    let avg: f64 = row
                        .get(offset + 4)
                        .and_then(|v| v.parse().ok())
                        .unwrap_or(0.0);
                    let avg_sq: f64 = row
                        .get(offset + 5)
                        .and_then(|v| v.parse().ok())
                        .unwrap_or(0.0);

                    let variance = avg_sq - (avg * avg);
                    let std_dev = if variance > 0.0 { variance.sqrt() } else { 0.0 };

                    let mut outliers_count = 0;
                    let inferred_type = if non_null_count > 0 && row.get(offset + 2).is_some() {
                        "NUMERIC".to_string()
                    } else {
                        "TEXT".to_string()
                    };

                    // Outlier analysis (requires a second pass per column if numeric)
                    if std_dev > 0.0 {
                        let outlier_query = format!(
                             "SELECT COUNT(*) FROM {q}{table}{q} WHERE ABS(CAST({q}{col}{q} as {rt}) - {}) > {}",
                             avg, 3.0 * std_dev, q = q, table = table, col = col, rt = real_type
                         );
                        if let Ok(QueryResult::ResultSet(ors)) =
                            adapter.execute_query(&outlier_query).await
                        {
                            outliers_count = ors
                                .rows
                                .first()
                                .and_then(|r| r.first())
                                .and_then(|v| v.parse().ok())
                                .unwrap_or(0);
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
                        mean: Some(avg),
                        std_dev: Some(std_dev),
                        outliers_count,
                    });
                }
            }
        } else {
            // Fallback for failed batch (maybe too many columns or complex types)
            for col in chunk {
                columns_profile.push(ColumnProfile {
                    name: col.clone(),
                    total_rows,
                    null_count: 0,
                    null_percentage: 0.0,
                    distinct_count: 0,
                    inferred_type: "UNKNOWN".to_string(),
                    min: None,
                    max: None,
                    mean: None,
                    std_dev: None,
                    outliers_count: 0,
                });
            }
        }
    }

    // 4. Duplicate Check (Optimized: Skip if too many columns or too many rows)
    let mut duplicates_count = 0;
    if col_names.len() < 50 && total_rows < 100000 {
        let distinct_rows_query = format!(
            "SELECT COUNT(*) FROM (SELECT DISTINCT * FROM {q}{table}{q}) as sub",
            q = q,
            table = table
        );

        if let Ok(QueryResult::ResultSet(rs)) = adapter.execute_query(&distinct_rows_query).await {
            let distinct_rows: i64 = rs
                .rows
                .first()
                .and_then(|r| r.first())
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);
            if total_rows > distinct_rows {
                duplicates_count = total_rows - distinct_rows;
            }
        }
    }

    Ok(TableProfile {
        table_name: table.to_string(),
        row_count: total_rows,
        columns: columns_profile,
        duplicates_count,
    })
}
