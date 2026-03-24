use tokio::sync::Mutex;
use crate::adapter::DbAdapter;

pub struct DbState {
    pub adapter: Mutex<Option<DbAdapter>>,
}

impl DbState {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Default for DbState {
    fn default() -> Self {
        Self {
            adapter: Mutex::new(None),
        }
    }
}
