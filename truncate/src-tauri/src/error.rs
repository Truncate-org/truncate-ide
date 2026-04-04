use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};
use std::fmt;

#[derive(Debug)]
pub enum TruncateError {
    CliNotFound { tool: String, install_hint: String },
    OllamaNotRunning { install_hint: String },
    OllamaNotInstalled { install_hint: String },
    DatabaseConnectionFailed { reason: String },
    QuerySafetyViolation { query: String, reason: String },
    InternalError { message: String },
}

impl fmt::Display for TruncateError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CliNotFound { tool, install_hint } => {
                write!(f, "CLI tool '{}' not found. {}", tool, install_hint)
            }
            Self::OllamaNotRunning { install_hint } => {
                write!(f, "Ollama is not running. {}", install_hint)
            }
            Self::OllamaNotInstalled { install_hint } => {
                write!(f, "Ollama is not installed. {}", install_hint)
            }
            Self::DatabaseConnectionFailed { reason } => {
                write!(f, "Database connection failed: {}", reason)
            }
            Self::QuerySafetyViolation { query, reason } => {
                write!(f, "Safety violation in query '{}': {}", query, reason)
            }
            Self::InternalError { message } => {
                write!(f, "Internal error: {}", message)
            }
        }
    }
}

impl std::error::Error for TruncateError {}

// Custom serialization to match the TypeScript schema precisely:
// { "code": string, "message": string, "hint": string | null }
impl Serialize for TruncateError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("TruncateError", 3)?;
        match self {
            Self::CliNotFound {
                tool: _,
                install_hint,
            } => {
                state.serialize_field("code", "CLI_NOT_FOUND")?;
                state.serialize_field("message", &self.to_string())?;
                state.serialize_field("hint", &Some(install_hint))?;
            }
            Self::OllamaNotRunning { install_hint } => {
                state.serialize_field("code", "OLLAMA_NOT_RUNNING")?;
                state.serialize_field("message", &self.to_string())?;
                state.serialize_field("hint", &Some(install_hint))?;
            }
            Self::OllamaNotInstalled { install_hint } => {
                state.serialize_field("code", "OLLAMA_NOT_INSTALLED")?;
                state.serialize_field("message", &self.to_string())?;
                state.serialize_field("hint", &Some(install_hint))?;
            }
            Self::DatabaseConnectionFailed { reason: _ } => {
                state.serialize_field("code", "DATABASE_CONNECTION_FAILED")?;
                state.serialize_field("message", &self.to_string())?;
                state.serialize_field("hint", &None::<String>)?;
            }
            Self::QuerySafetyViolation {
                query: _,
                reason: _,
            } => {
                state.serialize_field("code", "QUERY_SAFETY_VIOLATION")?;
                state.serialize_field("message", &self.to_string())?;
                state.serialize_field("hint", &None::<String>)?;
            }
            Self::InternalError { message: _ } => {
                state.serialize_field("code", "INTERNAL_ERROR")?;
                state.serialize_field("message", &self.to_string())?;
                state.serialize_field("hint", &None::<String>)?;
            }
        }
        state.end()
    }
}
