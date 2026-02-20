use thiserror::Error;

#[derive(Error, Debug)]
pub enum HarpyError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Redis error: {0}")]
    Redis(String),

    #[error("Provider error: {0}")]
    Provider(String),

    #[error("Protobuf encode/decode error: {0}")]
    Protobuf(String),

    #[error("WebSocket error: {0}")]
    WebSocket(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, HarpyError>;
