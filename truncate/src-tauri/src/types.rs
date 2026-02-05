use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
pub struct TablePreview {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub limited: bool,
    pub formatted_output: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(tag = "type", content = "data")]
pub enum QueryResult {
    ResultSet(TablePreview),
    Success(String),
    Error(String),
}

#[derive(Serialize, Clone, Debug)]
pub struct CsvInspection {
    pub columns: Vec<String>,
    pub types: Vec<String>, // "INTEGER", "REAL", "TEXT"
    pub separator: char,
    pub preview: Vec<Vec<String>>,
}

