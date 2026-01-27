use tokio::sync::Mutex;
use crate::adapter::DbAdapter;

pub struct DbState {
    pub adapter: Mutex<Option<DbAdapter>>,
}

impl DbState {
    pub fn new() -> Self {
        Self {
            adapter: Mutex::new(None),
        }
    }
}
