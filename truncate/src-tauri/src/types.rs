use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
pub struct TablePreview {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub limited: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(tag = "type", content = "data")]
pub enum QueryResult {
    ResultSet(TablePreview),
    Success(String),
}
