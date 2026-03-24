#[derive(Clone, Debug, PartialEq)]
pub enum ConnectionType {
    MySQL,
    PostgreSQL,
    SQLite,
    Csv,
}

#[derive(Clone, Debug)]
pub struct ConnectionConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub pass: String,
    pub db_type: ConnectionType,
    pub current_database: Option<String>,
}

use crate::csv_adapter::CsvAdapter;
use crate::mysql_adapter::MySqlAdapter;
use crate::postgres_adapter::PostgresAdapter;
use crate::sqlite_adapter::SqliteAdapter;
use crate::types::{QueryResult, TablePreview};
use async_trait::async_trait;

#[async_trait]
pub trait DatabaseAdapter: Send + Sync {
    async fn connect(&mut self) -> Result<(), String>;
    async fn list_databases(&self) -> Result<Vec<String>, String>;
    async fn switch_database(&mut self, db_name: &str) -> Result<bool, String>;
    async fn execute_query(&self, sql: &str) -> Result<QueryResult, String>;
    async fn preview_table(&self, table_name: &str) -> Result<TablePreview, String>;
    async fn list_tables(&self) -> Result<Vec<String>, String>;
    async fn disconnect(&mut self) -> Result<(), String>;
    async fn get_current_database(&self) -> Result<String, String>;
    fn get_connection_config(&self) -> ConnectionConfig;
    async fn extract_schema(&self, db_name: &str) -> Result<crate::schema::Schema, String>;
    async fn drop_database(&mut self, db_name: &str) -> Result<(), String>;
}

pub enum DbAdapter {
    MySql(MySqlAdapter),
    Postgres(PostgresAdapter),
    Sqlite(SqliteAdapter),
    Csv(CsvAdapter),
}

#[async_trait]
impl DatabaseAdapter for DbAdapter {
    async fn connect(&mut self) -> Result<(), String> {
        match self {
            DbAdapter::MySql(a) => a.connect().await,
            DbAdapter::Postgres(a) => a.connect().await,
            DbAdapter::Sqlite(a) => a.connect().await,
            DbAdapter::Csv(a) => a.connect().await,
        }
    }

    async fn list_databases(&self) -> Result<Vec<String>, String> {
        match self {
            DbAdapter::MySql(a) => a.list_databases().await,
            DbAdapter::Postgres(a) => a.list_databases().await,
            DbAdapter::Sqlite(a) => a.list_databases().await,
            DbAdapter::Csv(a) => a.list_databases().await,
        }
    }

    async fn switch_database(&mut self, db_name: &str) -> Result<bool, String> {
        match self {
            DbAdapter::MySql(a) => a.switch_database(db_name).await,
            DbAdapter::Postgres(a) => a.switch_database(db_name).await,
            DbAdapter::Sqlite(a) => a.switch_database(db_name).await,
            DbAdapter::Csv(a) => a.switch_database(db_name).await,
        }
    }

    async fn execute_query(&self, sql: &str) -> Result<QueryResult, String> {
        match self {
            DbAdapter::MySql(a) => a.execute_query(sql).await,
            DbAdapter::Postgres(a) => a.execute_query(sql).await,
            DbAdapter::Sqlite(a) => a.execute_query(sql).await,
            DbAdapter::Csv(a) => a.execute_query(sql).await,
        }
    }

    async fn preview_table(&self, table_name: &str) -> Result<TablePreview, String> {
        match self {
            DbAdapter::MySql(a) => a.preview_table(table_name).await,
            DbAdapter::Postgres(a) => a.preview_table(table_name).await,
            DbAdapter::Sqlite(a) => a.preview_table(table_name).await,
            DbAdapter::Csv(a) => a.preview_table(table_name).await,
        }
    }

    async fn list_tables(&self) -> Result<Vec<String>, String> {
        match self {
            DbAdapter::MySql(a) => a.list_tables().await,
            DbAdapter::Postgres(a) => a.list_tables().await,
            DbAdapter::Sqlite(a) => a.list_tables().await,
            DbAdapter::Csv(a) => a.list_tables().await,
        }
    }

    async fn disconnect(&mut self) -> Result<(), String> {
        match self {
            DbAdapter::MySql(a) => a.disconnect().await,
            DbAdapter::Postgres(a) => a.disconnect().await,
            DbAdapter::Sqlite(a) => a.disconnect().await,
            DbAdapter::Csv(a) => a.disconnect().await,
        }
    }

    async fn get_current_database(&self) -> Result<String, String> {
        match self {
            DbAdapter::MySql(a) => a.get_current_database().await,
            DbAdapter::Postgres(a) => a.get_current_database().await,
            DbAdapter::Sqlite(a) => a.get_current_database().await,
            DbAdapter::Csv(a) => a.get_current_database().await,
        }
    }

    fn get_connection_config(&self) -> ConnectionConfig {
        match self {
            DbAdapter::MySql(a) => a.get_connection_config(),
            DbAdapter::Postgres(a) => a.get_connection_config(),
            DbAdapter::Sqlite(a) => a.get_connection_config(),
            DbAdapter::Csv(a) => a.get_connection_config(),
        }
    }

    async fn extract_schema(&self, db_name: &str) -> Result<crate::schema::Schema, String> {
        match self {
            DbAdapter::MySql(a) => a.extract_schema(db_name).await,
            DbAdapter::Postgres(a) => a.extract_schema(db_name).await,
            DbAdapter::Sqlite(a) => a.extract_schema(db_name).await,
            DbAdapter::Csv(a) => a.extract_schema(db_name).await,
        }
    }

    async fn drop_database(&mut self, db_name: &str) -> Result<(), String> {
        match self {
            DbAdapter::MySql(a) => a.drop_database(db_name).await,
            DbAdapter::Postgres(a) => a.drop_database(db_name).await,
            DbAdapter::Sqlite(a) => a.drop_database(db_name).await,
            DbAdapter::Csv(a) => a.drop_database(db_name).await,
        }
    }
}
