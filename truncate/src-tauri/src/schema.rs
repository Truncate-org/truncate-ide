use serde::{Deserialize, Serialize};

use std::fs;

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

pub fn generate_dot(schema: &Schema) -> String {
    let mut dot = String::from("digraph DatabaseSchema {\n");
    dot.push_str("    rankdir=LR;\n");
    dot.push_str("    node [shape=plaintext];\n");
    dot.push_str("    nodesep=0.5;\n");

    for table in &schema.tables {
        dot.push_str(&format!(
            "    {0} [label=<<TABLE BORDER=\"0\" CELLBORDER=\"1\" CELLSPACING=\"0\">\n",
            table.name
        ));
        dot.push_str(&format!(
            "        <TR><TD BGCOLOR=\"#DDDDDD\"><B>{}</B></TD></TR>\n",
            table.name
        ));

        for col in &table.columns {
            let key_marker = match &col.key_type {
                Some(k) if k == "PRI" => " (PK)",
                Some(k) if k == "MUL" => " (FK)",
                _ => "",
            };
            dot.push_str(&format!(
                "        <TR><TD ALIGN=\"LEFT\">{}{} : {}</TD></TR>\n",
                col.name, key_marker, col.data_type
            ));
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
    md.push_str(&format!("# Database Schema: {}\n", schema.database_name));
    md.push('\n');
    md.push_str("## Overview\n");
    md.push_str(&format!("- **Total Tables**: {}\n", schema.tables.len()));

    md.push_str("\n## Tables\n");
    for table in &schema.tables {
        md.push_str(&format!("### {}\n", table.name));
        md.push_str("| Column | Type | Nullable | Key |\n");
        md.push_str("|---|---|---|---|\n");
        for col in &table.columns {
            let key = col.key_type.as_deref().unwrap_or("");
            md.push_str(&format!(
                "| {} | {} | {} | {} |\n",
                col.name, col.data_type, col.is_nullable, key
            ));
        }
        md.push('\n');

        if !table.foreign_keys.is_empty() {
            md.push_str("**Foreign Keys**:\n");
            for fk in &table.foreign_keys {
                md.push_str(&format!(
                    "- `{}` -> `{}.{}`\n",
                    fk.column_name, fk.ref_table, fk.ref_column
                ));
            }
            md.push('\n');
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

pub fn save_schema_files(
    schema: &Schema,
    base_path: &std::path::Path,
    app_handle: &tauri::AppHandle,
) -> Result<ExportResult, String> {
    // Create a subdirectory for the export
    let folder_name = format!("Truncate_Export_{}", schema.database_name);
    let mut export_dir = base_path.to_path_buf();
    export_dir.push(&folder_name);

    if !export_dir.exists() {
        fs::create_dir_all(&export_dir)
            .map_err(|e| format!("Failed to create export directory: {}", e))?;
    }

    let json_content = serde_json::to_string_pretty(schema)
        .map_err(|e| format!("Failed to serialize schema: {}", e))?;

    let dot_content = generate_dot(schema);
    let md_content = generate_markdown_summary(schema);

    let json_path = export_dir.join(format!("{}_schema.json", schema.database_name));
    let dot_path = export_dir.join(format!("{}_doc.dot", schema.database_name));
    let md_path = export_dir.join(format!("{}_doc.md", schema.database_name));

    fs::write(&json_path, json_content).map_err(|e| format!("Failed to write JSON: {}", e))?;

    fs::write(&dot_path, &dot_content).map_err(|e| format!("Failed to write DOT: {}", e))?;

    fs::write(&md_path, &md_content).map_err(|e| format!("Failed to write Markdown: {}", e))?;

    // Attempt SVG generation using Bundled Resource
    let svg_path_buf = export_dir.join(format!("{}_diagram.svg", schema.database_name));
    let svg_path_str = svg_path_buf.to_string_lossy().to_string();

    // Resolve resource path
    use tauri::path::BaseDirectory;
    use tauri::Manager;

    let dot_binary_name = if cfg!(target_os = "macos") {
        "bin/dot-aarch64-apple-darwin"
    } else if cfg!(target_os = "linux") {
        "bin/dot-unknown-linux-gnu"
    } else {
        // Fallback or error - maybe windows needs .exe?
        "bin/dot"
    };

    let dot_resource_path = app_handle
        .path()
        .resolve(dot_binary_name, BaseDirectory::Resource);

    let svg_generated = match dot_resource_path {
        Ok(path) => {
            // Ensure it is executable? It should be if we chmod-ed it before build.
            Command::new(path)
                .args(["-Tsvg", &dot_path.to_string_lossy(), "-o", &svg_path_str])
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
        }
        Err(_e) => false,
    };

    Ok(ExportResult {
        success: true,
        json_path: json_path.to_string_lossy().to_string(),
        dot_path: dot_path.to_string_lossy().to_string(),
        svg_path: if svg_generated {
            Some(svg_path_str)
        } else {
            None
        },
        markdown_path: md_path.to_string_lossy().to_string(),
        export_dir: export_dir.to_string_lossy().to_string(),
        message: if svg_generated {
            format!("Exported to: {}", export_dir.to_string_lossy())
        } else {
            format!(
                "Exported to: {} (Bundled Graphviz failed)",
                export_dir.to_string_lossy()
            )
        },
    })
}
