use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Plan {
    pub steps: Vec<String>,
}
