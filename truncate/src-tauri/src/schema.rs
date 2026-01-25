use serde::{Serialize, Deserialize};
use sqlx::MySqlPool;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Schema {
    pub database_name: String,
    pub tables: Vec<Table>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Table {
    pub name: String,
    pub columns: Vec<Column>,
    pub foreign_keys: Vec<ForeignKey>,
    pub primary_keys: Vec<String>,
}

fn get_string_from_row(row: &sqlx::mysql::MySqlRow, column: &str) -> String {
    use sqlx::Row;
    // Try as String first
    if let Ok(s) = row.try_get::<String, _>(column) {
        return s;
    }
    // Try as Vec<u8> (BLOB/BINARY) and convert
    if let Ok(bytes) = row.try_get::<Vec<u8>, _>(column) {
        return String::from_utf8_lossy(&bytes).to_string();
    }
    // Fallback or empty (should not happen for metadata usually)
    String::new()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Column {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub key_type: Option<String>, // PRI, MUL, UNI
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ForeignKey {
    pub column_name: String,
    pub ref_table: String,
    pub ref_column: String,
}

pub async fn extract_schema(pool: &MySqlPool, db_name: &str) -> Result<Schema, String> {
    // 1. Get Tables
    let tables_query = "
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
    ";
    let rows = sqlx::query(tables_query)
        .bind(db_name)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to fetch tables: {}", e))?;

    let mut tables = Vec::new();

    for row in rows {
        let table_name = get_string_from_row(&row, "TABLE_NAME");
        
        // 2. Get Columns
        let columns_query = "
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        ";
        let col_rows = sqlx::query(columns_query)
            .bind(db_name)
            .bind(&table_name)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to fetch columns for {}: {}", table_name, e))?;

        let mut columns = Vec::new();
        let mut primary_keys = Vec::new();

        for col_row in col_rows {
            let name = get_string_from_row(&col_row, "COLUMN_NAME");
            let data_type = get_string_from_row(&col_row, "DATA_TYPE");
            let is_nullable_str = get_string_from_row(&col_row, "IS_NULLABLE");
            let key_type = get_string_from_row(&col_row, "COLUMN_KEY");

            if key_type == "PRI" {
                primary_keys.push(name.clone());
            }

            columns.push(Column {
                name,
                data_type,
                is_nullable: is_nullable_str == "YES",
                key_type: if key_type.is_empty() { None } else { Some(key_type) },
            });
        }

        // 3. Get Foreign Keys
        let fk_query = "
            SELECT 
                COLUMN_NAME, 
                REFERENCED_TABLE_NAME, 
                REFERENCED_COLUMN_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE 
                TABLE_SCHEMA = ? 
                AND TABLE_NAME = ? 
                AND REFERENCED_TABLE_NAME IS NOT NULL
        ";
        let fk_rows = sqlx::query(fk_query)
            .bind(db_name)
            .bind(&table_name)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to fetch foreign keys for {}: {}", table_name, e))?;

        let mut foreign_keys = Vec::new();
        for fk_row in fk_rows {
            foreign_keys.push(ForeignKey {
                column_name: get_string_from_row(&fk_row, "COLUMN_NAME"),
                ref_table: get_string_from_row(&fk_row, "REFERENCED_TABLE_NAME"),
                ref_column: get_string_from_row(&fk_row, "REFERENCED_COLUMN_NAME"),
            });
        }

        tables.push(Table {
            name: table_name,
            columns,
            foreign_keys,
            primary_keys,
        });
    }

    Ok(Schema {
        database_name: db_name.to_string(),
        tables,
    })
}

pub fn generate_dot(schema: &Schema) -> String {
    let mut dot = String::from("digraph DatabaseSchema {\n");
    dot.push_str("    rankdir=LR;\n");
    dot.push_str("    node [shape=plaintext];\n");
    dot.push_str("    nodesep=0.5;\n");

    for table in &schema.tables {
        dot.push_str(&format!("    {0} [label=<<TABLE BORDER=\"0\" CELLBORDER=\"1\" CELLSPACING=\"0\">\n", table.name));
        dot.push_str(&format!("        <TR><TD BGCOLOR=\"#DDDDDD\"><B>{}</B></TD></TR>\n", table.name));
        
        for col in &table.columns {
            let key_marker = match &col.key_type {
                Some(k) if k == "PRI" => " (PK)",
                Some(k) if k == "MUL" => " (FK)",
                _ => "",
            };
            dot.push_str(&format!("        <TR><TD ALIGN=\"LEFT\">{}{} : {}</TD></TR>\n", col.name, key_marker, col.data_type));
        }
        dot.push_str("    </TABLE>>];\n");

        for fk in &table.foreign_keys {
            dot.push_str(&format!("    {} -> {};\n", table.name, fk.ref_table));
        }
    }

    dot.push_str("}\n");
    dot
}

pub fn generate_markdown_summary(schema: &Schema) -> String {
    let mut md = String::new();
    md.push_str(&format!("# Database Schema: {}\n\n", schema.database_name));
    md.push_str("## Overview\n");
    md.push_str(&format!("- **Total Tables**: {}\n", schema.tables.len()));
    
    md.push_str("\n## Tables\n");
    for table in &schema.tables {
        md.push_str(&format!("### {}\n", table.name));
        md.push_str("| Column | Type | Nullable | Key |\n");
        md.push_str("|---|---|---|---|\n");
        for col in &table.columns {
            let key = col.key_type.as_deref().unwrap_or("");
            md.push_str(&format!("| {} | {} | {} | {} |\n", col.name, col.data_type, col.is_nullable, key));
        }
        md.push_str("\n");
        
        if !table.foreign_keys.is_empty() {
            md.push_str("**Foreign Keys**:\n");
            for fk in &table.foreign_keys {
                md.push_str(&format!("- `{}` -> `{}.{}`\n", fk.column_name, fk.ref_table, fk.ref_column));
            }
            md.push_str("\n");
        }
    }
    
    md.push_str("\n## AI Analysis Request\n");
    md.push_str("To get an AI explanation of this database, copy the content above and ask:\n");
    md.push_str("> \"Analyze this database schema. Explain the relationships, identify the core domains, and suggest potential optimizations or missing indexes.\"\n");
    
    md
}

#[derive(Serialize)]
pub struct ExportResult {
    pub success: bool,
    pub json_path: String,
    pub dot_path: String,
    pub svg_path: Option<String>,
    pub markdown_path: String,
    pub export_dir: String,
    pub message: String,
}



pub fn save_schema_files(schema: &Schema, base_path: &PathBuf, app_handle: &tauri::AppHandle) -> Result<ExportResult, String> {
    // Create a subdirectory for the export
    let folder_name = format!("Truncate_Export_{}", schema.database_name);
    let mut export_dir = base_path.clone();
    export_dir.push(&folder_name);

    if !export_dir.exists() {
        fs::create_dir_all(&export_dir)
            .map_err(|e| format!("Failed to create export directory: {}", e))?;
    }

    let json_content = serde_json::to_string_pretty(schema)
        .map_err(|e| format!("Failed to serialize schema: {}", e))?;
    
    let dot_content = generate_dot(schema);
    let md_content = generate_markdown_summary(schema);
    
    let mut json_path = export_dir.clone();
    json_path.push(format!("{}_schema.json", schema.database_name));

    let mut dot_path = export_dir.clone();
    dot_path.push(format!("{}_doc.dot", schema.database_name));

    let mut md_path = export_dir.clone();
    md_path.push(format!("{}_doc.md", schema.database_name));
    
    fs::write(&json_path, json_content)
        .map_err(|e| format!("Failed to write JSON: {}", e))?;
        
    fs::write(&dot_path, &dot_content)
        .map_err(|e| format!("Failed to write DOT: {}", e))?;

    fs::write(&md_path, &md_content)
        .map_err(|e| format!("Failed to write Markdown: {}", e))?;

    // Attempt SVG generation using Bundled Resource
    let mut svg_path_buf = export_dir.clone();
    svg_path_buf.push(format!("{}_diagram.svg", schema.database_name));
    let svg_path_str = svg_path_buf.to_string_lossy().to_string();
    
    // Resolve resource path
    use tauri::path::BaseDirectory;
    use tauri::Manager;

    let dot_resource_path = app_handle.path().resolve("bin/dot-aarch64-apple-darwin", BaseDirectory::Resource);
    
    let svg_generated = match dot_resource_path {
        Ok(path) => {
             // Ensure it is executable? It should be if we chmod-ed it before build.
             Command::new(path)
                .args(["-Tsvg", &dot_path.to_string_lossy(), "-o", &svg_path_str])
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
        },
        Err(e) => {
            eprintln!("Failed to resolve dot binary: {}", e);
            false
        }
    };

    Ok(ExportResult {
        success: true,
        json_path: json_path.to_string_lossy().to_string(),
        dot_path: dot_path.to_string_lossy().to_string(),
        svg_path: if svg_generated { Some(svg_path_str) } else { None },
        markdown_path: md_path.to_string_lossy().to_string(),
        export_dir: export_dir.to_string_lossy().to_string(),
        message: if svg_generated { 
            format!("Exported to: {}", export_dir.to_string_lossy()) 
        } else { 
            format!("Exported to: {} (Bundled Graphviz failed)", export_dir.to_string_lossy()) 
        },
    })
}
