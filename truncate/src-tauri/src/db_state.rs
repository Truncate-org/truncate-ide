use sqlx::mysql::MySqlPool;
use std::sync::Mutex;

#[derive(Clone)]
pub struct ConnectionConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub pass: String,
}

pub struct DbState {
    pub pool: Mutex<Option<MySqlPool>>,
    pub config: Mutex<Option<ConnectionConfig>>,
}

impl DbState {
    pub fn new() -> Self {
        Self {
            pool: Mutex::new(None),
            config: Mutex::new(None),
        }
    }
}
