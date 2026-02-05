use async_trait::async_trait;
use crate::adapter::{DatabaseAdapter, ConnectionConfig, ConnectionType};
use crate::types::{QueryResult, TablePreview, CsvInspection};
use crate::schema::Schema;
use crate::sqlite_adapter::SqliteAdapter;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs::File;
use std::io::BufReader;
use tempfile::NamedTempFile;
use sqlx::{Pool, Sqlite, Row};
use tokio::sync::mpsc;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CsvConfig {
    pub columns: Vec<String>,
    pub types: Vec<String>, // INTEGER, REAL, TEXT
    pub separator: char,
}

pub struct CsvAdapter {
    sqlite_adapter: SqliteAdapter,
    _temp_file: Option<NamedTempFile>, // Keep alive
    original_path: String,
    config: CsvConfig,
}

impl CsvAdapter {
    pub fn new(path: &str, config_json: &str) -> Result<Self, String> {
        let config: CsvConfig = serde_json::from_str(config_json)
            .map_err(|e| format!("Invalid CSV config: {}", e))?;
            
        Ok(Self {
            sqlite_adapter: SqliteAdapter::new(""), // Placeholder
            _temp_file: None,
            original_path: path.to_string(),
            config,
        })
    }
}

// Standalone inspection function
pub fn inspect_csv(path_str: &str) -> Result<CsvInspection, String> {
    let path = Path::new(path_str);
    if !path.exists() {
        return Err(format!("File not found: {}", path_str));
    }

    // Detect separator
    let extension = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    let separator = if extension == "tsv" || extension == "tab" { '\t' } else { ',' };

    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(separator as u8)
        .has_headers(true) 
        .from_reader(BufReader::new(file));

    // Get headers
    let headers_res = reader.headers().map_err(|e| format!("Failed to read headers: {}", e))?;
    let columns: Vec<String> = headers_res.iter().map(|s| s.to_string()).collect();

    // Sample rows
    let mut preview = Vec::new();
    let mut samples = Vec::new(); 
    
    for result in reader.records().take(100) {
        let record = result.map_err(|e| format!("Failed to read record: {}", e))?;
        let row: Vec<String> = record.iter().map(|s| s.to_string()).collect();
        preview.push(row.clone());
        samples.push(row);
    }
    
    // Infer types
    let mut types = Vec::new();
    for i in 0..columns.len() {
        let mut is_int = true;
        let mut is_real = true;
        
        for row in &samples {
            if i >= row.len() { continue; }
            let val = &row[i];
            if val.is_empty() { continue; } // Empty can be anything (likely NULL)
            
            if is_int && val.parse::<i64>().is_err() {
                is_int = false;
            }
            if is_real && val.parse::<f64>().is_err() {
                is_real = false;
            }
        }
        
        if is_int {
            types.push("INTEGER".to_string());
        } else if is_real {
            types.push("REAL".to_string());
        } else {
            types.push("TEXT".to_string());
        }
    }
    
    if types.is_empty() {
        for _ in &columns {
            types.push("TEXT".to_string());
        }
    }

    Ok(CsvInspection {
        columns,
        types,
        separator,
        preview,
    })
}

#[async_trait]
impl DatabaseAdapter for CsvAdapter {
    async fn connect(&mut self) -> Result<(), String> {
        // 1. Create Temp File
        let temp_file = NamedTempFile::new()
            .map_err(|e| format!("Failed to create temp database: {}", e))?;
        let temp_path = temp_file.path().to_str().ok_or("Invalid temp path")?.to_string();
        
        // 2. Initialize SqliteAdapter
        let mut adapter = SqliteAdapter::new(&temp_path);
        adapter.connect().await?;
        
        let pool = adapter.pool.clone().ok_or("Failed to get SQLite pool")?;
        
        // 3. Create Tables
        let table_name = "csv_data";
        let bad_rows_table = "csv_data_bad_rows";
        
        let mut create_sql = format!("CREATE TABLE {} (", table_name);
        for (i, (col, date_type)) in self.config.columns.iter().zip(self.config.types.iter()).enumerate() {
            create_sql.push_str(&format!("\"{}\" {}", col, date_type));
            if i < self.config.columns.len() - 1 {
                create_sql.push_str(", ");
            }
        }
        create_sql.push_str(");");
        
        adapter.execute_query(&create_sql).await
            .map_err(|e| format!("Failed to create main table: {:?} SQL: {}", e, create_sql))?;
            
        let create_bad_sql = format!(
            "CREATE TABLE {} (line_number INTEGER, raw_content TEXT, error_reason TEXT);", 
            bad_rows_table
        );
         adapter.execute_query(&create_bad_sql).await
            .map_err(|e| format!("Failed to create bad rows table: {:?}", e))?;
            
        // 4. Load Data (Streaming / Batching)
        let path_clone = self.original_path.clone();
        let config_clone = self.config.clone();
        
        // Channel for passing batches
        // Batch type: (Vec<ValidRowArgs>, Vec<BadRowArgs>)
        // ValidRowArgs: Vec<String> values
        // BadRowArgs: (line_number, raw_content, error_reason)
        let (tx, mut rx) = mpsc::channel::<(Vec<Vec<String>>, Vec<(usize, String, String)>)>(10);
        
        tokio::task::spawn_blocking(move || {
            let file = match File::open(&path_clone) {
                Ok(f) => f,
                Err(e) => {
                    let _ = tx.blocking_send((vec![], vec![(0, "".to_string(), format!("Failed to open file: {}", e))]));
                    return;
                }
            };
            
            let mut rdr = csv::ReaderBuilder::new()
                .delimiter(config_clone.separator as u8)
                .has_headers(true) 
                .from_reader(BufReader::new(file));
                
            let mut valid_batch = Vec::new();
            let mut bad_batch = Vec::new();
            let mut line_number = 1; // 1-indexed (header is 0 effectively, or 1 if skipping?)
            // csv::Reader tracks line numbers but let's track manually index
            
            for result in rdr.records() {
                line_number += 1; // Assuming header was line 1
                
                match result {
                    Ok(record) => {
                        let row: Vec<String> = record.iter().map(|s| s.to_string()).collect();
                        
                        // Validation
                        let mut error: Option<String> = None;
                        
                        // 1. Column count
                        if row.len() != config_clone.columns.len() {
                             error = Some(format!("Column count mismatch: expected {}, got {}", config_clone.columns.len(), row.len()));
                        } else {
                            // 2. Type validation
                            for (i, val) in row.iter().enumerate() {
                                let expected_type = &config_clone.types[i];
                                if val.is_empty() { continue; } // Allow empty (NULL)
                                
                                if expected_type == "INTEGER" {
                                    if val.parse::<i64>().is_err() {
                                        error = Some(format!("Type mismatch in col {}: expected INTEGER, got '{}'", config_clone.columns[i], val));
                                        break;
                                    }
                                } else if expected_type == "REAL" {
                                    if val.parse::<f64>().is_err() {
                                        error = Some(format!("Type mismatch in col {}: expected REAL, got '{}'", config_clone.columns[i], val));
                                        break;
                                    }
                                }
                            }
                        }
                        
                        if let Some(err) = error {
                            bad_batch.push((line_number, format!("{:?}", row), err));
                        } else {
                            valid_batch.push(row);
                        }
                    },
                    Err(e) => {
                         bad_batch.push((line_number, "<read_error>".to_string(), e.to_string()));
                    }
                }
                
                if valid_batch.len() >= 1000 || bad_batch.len() >= 1000 {
                    if tx.blocking_send((valid_batch.clone(), bad_batch.clone())).is_err() {
                        break;
                    }
                    valid_batch.clear();
                    bad_batch.clear();
                }
            }
            
            // Send remaining
            if !valid_batch.is_empty() || !bad_batch.is_empty() {
                let _ = tx.blocking_send((valid_batch, bad_batch));
            }
        });
        
        // Receive and Insert
        while let Some((valid_batch, bad_batch)) = rx.recv().await {
            // Insert Valid
            if !valid_batch.is_empty() {
                // Bulk insert is tricky with sqlx and variable args. 
                // We'll use a transaction and individual inserts (loop) for simplicity,
                // or build a large VALUES (), (), () string.
                // Large VALUES string is faster.
                
                let mut query_builder = format!("INSERT INTO {} VALUES ", table_name);
                let mut params_count = 0;
                let batch_size = valid_batch.len();
                
                // Construct query: (?, ?, ?), (?, ?, ?) ...
                // Actually, string construction is unsafe if we don't bind parameters.
                // But binding thousands of params is also tricky.
                // SQLite has limit on vars (999 or 32766).
                // Safest to just loop with transaction? 
                // Or "Insert into ... select ... union all select ... "
                // Let's use transaction + individual commands prepared? Or chunks of 50.
                
                // For simplicity and safety (handling quotes etc), parametrized query is best.
                // But batch insert in sqlx for SQLite isn't super straightforward without query builder.
                // Let's start transaction.
                
                let mut tx = pool.begin().await.map_err(|e| format!("Failed to begin transaction: {}", e))?;
                
                for row in valid_batch {
                    let mut insert_sql = format!("INSERT INTO {} VALUES (", table_name);
                    for _ in 0..row.len() {
                        insert_sql.push_str("?,");
                    }
                    insert_sql.pop(); // remove last comma
                    insert_sql.push_str(")");
                    
                    let mut query = sqlx::query(&insert_sql);
                    for val in row {
                         query = query.bind(val);
                    }
                    query.execute(&mut *tx).await.map_err(|e| format!("Insert failed: {}", e))?;
                }
                
                tx.commit().await.map_err(|e| format!("Commit failed: {}", e))?;
            }
            
            // Insert Bad
             if !bad_batch.is_empty() {
                let mut tx = pool.begin().await.map_err(|e| format!("Failed to begin transaction for bad rows: {}", e))?;
                for (line, content, reason) in bad_batch {
                    sqlx::query(&format!("INSERT INTO {} (line_number, raw_content, error_reason) VALUES (?, ?, ?)", bad_rows_table))
                        .bind(line as i64)
                        .bind(content)
                        .bind(reason)
                        .execute(&mut *tx).await.map_err(|e| format!("Insert bad row failed: {}", e))?;
                }
                tx.commit().await.map_err(|e| format!("Commit bad rows failed: {}", e))?;
             }
        }
        
        self.sqlite_adapter = adapter;
        self._temp_file = Some(temp_file);
        
        Ok(())
    }

    async fn list_databases(&self) -> Result<Vec<String>, String> {
        self.sqlite_adapter.list_databases().await
    }

    async fn switch_database(&mut self, db_name: &str) -> Result<bool, String> {
        self.sqlite_adapter.switch_database(db_name).await
    }

    async fn execute_query(&self, sql: &str) -> Result<QueryResult, String> {
        self.sqlite_adapter.execute_query(sql).await
    }

    async fn preview_table(&self, table_name: &str) -> Result<TablePreview, String> {
        self.sqlite_adapter.preview_table(table_name).await
    }

    async fn list_tables(&self) -> Result<Vec<String>, String> {
        self.sqlite_adapter.list_tables().await
    }

    async fn disconnect(&mut self) -> Result<(), String> {
        self.sqlite_adapter.disconnect().await?;
        self._temp_file = None; 
        Ok(())
    }

    async fn get_current_database(&self) -> Result<String, String> {
        Ok(format!("CSV: {}", Path::new(&self.original_path).file_name().unwrap_or_default().to_string_lossy()))
    }

    fn get_connection_config(&self) -> ConnectionConfig {
        let mut c = self.sqlite_adapter.get_connection_config();
        c.db_type = ConnectionType::Csv;
        c
    }

    async fn extract_schema(&self, db_name: &str) -> Result<Schema, String> {
        self.sqlite_adapter.extract_schema(db_name).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[tokio::test]
    async fn test_csv_loading() {
        // Create dummy CSV
        let mut temp_csv = NamedTempFile::new().unwrap();
        writeln!(temp_csv, "id,name,val").unwrap();
        writeln!(temp_csv, "1,Alice,10.5").unwrap();
        writeln!(temp_csv, "2,Bob,20.0").unwrap();
        writeln!(temp_csv, "bad,Charlie,30.0").unwrap(); // Bad integer
        let path = temp_csv.path().to_str().unwrap().to_string();

        let config = CsvConfig {
            columns: vec!["id".into(), "name".into(), "val".into()],
            types: vec!["INTEGER".into(), "TEXT".into(), "REAL".into()],
            separator: ',',
        };
        let config_json = serde_json::to_string(&config).unwrap();

        let mut adapter = CsvAdapter::new(&path, &config_json).unwrap();
        adapter.connect().await.expect("Connect failed");

        // Query valid
        let res = adapter.execute_query("SELECT * FROM csv_data ORDER BY id").await.expect("Query failed");
        if let QueryResult::ResultSet(preview) = res {
            // Note: bad row (id="bad") is skipped, so we expect 2 rows (id=1, id=2).
            assert_eq!(preview.rows.len(), 2, "Expected 2 valid rows");
            assert_eq!(preview.rows[0][1], "Alice");
        } else { panic!("Wrong result type"); }

        // Query bad
        let res = adapter.execute_query("SELECT * FROM csv_data_bad_rows").await.expect("Query bad failed");
        if let QueryResult::ResultSet(preview) = res {
             assert_eq!(preview.rows.len(), 1, "Expected 1 bad row");
             println!("Bad row error: {}", preview.rows[0][2]);
             assert!(preview.rows[0][2].contains("Type mismatch"));
        }
        
        adapter.disconnect().await.unwrap();
    }
}
