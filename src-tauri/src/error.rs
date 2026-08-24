use std::{error::Error, fmt, io, path::PathBuf};

use serde::Serialize;

#[derive(Debug)]
pub enum HostError {
    SpawnFailed { binary: PathBuf, source: io::Error },
    StdioUnavailable(&'static str),
    TransportClosed,
    RuntimeFailure(String),
    PendingStatePoisoned,
    RuntimeNotReady,
    WriteFailed(io::Error),
    FlushFailed(io::Error),
    Timeout { method: String },
    FrameTooLarge { length: usize, limit: usize },
    SerializationFailed(serde_json::Error),
    ReadFailed(io::Error),
}

impl HostError {
    pub fn kind(&self) -> &'static str {
        match self {
            Self::SpawnFailed { .. } => "spawnFailed",
            Self::StdioUnavailable(_) => "stdioUnavailable",
            Self::TransportClosed => "transportClosed",
            Self::RuntimeFailure(_) => "runtimeFailure",
            Self::PendingStatePoisoned => "pendingStatePoisoned",
            Self::RuntimeNotReady => "runtimeNotReady",
            Self::WriteFailed(_) => "writeFailed",
            Self::FlushFailed(_) => "flushFailed",
            Self::Timeout { .. } => "timeout",
            Self::FrameTooLarge { .. } => "frameTooLarge",
            Self::SerializationFailed(_) => "serializationFailed",
            Self::ReadFailed(_) => "readFailed",
        }
    }

    pub fn retryable(&self) -> bool {
        matches!(
            self,
            Self::TransportClosed
                | Self::WriteFailed(_)
                | Self::FlushFailed(_)
                | Self::Timeout { .. }
                | Self::ReadFailed(_)
        )
    }

    pub fn message(&self) -> String {
        match self {
            Self::SpawnFailed { binary, source } => format!(
                "unable to spawn codex app-server at {}: {source}",
                binary.display()
            ),
            Self::StdioUnavailable(stream) => format!("app-server {stream} unavailable"),
            Self::TransportClosed => "app-server transport closed".to_string(),
            Self::RuntimeFailure(message) => format!("app-server rejected request: {message}"),
            Self::PendingStatePoisoned => "request pending state is poisoned".to_string(),
            Self::RuntimeNotReady => "app-server runtime is not ready".to_string(),
            Self::WriteFailed(source) => format!("failed to write app-server request: {source}"),
            Self::FlushFailed(source) => format!("failed to flush app-server request: {source}"),
            Self::Timeout { method } => format!("app-server request timed out: {method}"),
            Self::FrameTooLarge { length, limit } => {
                format!("app-server frame is too large: {length} bytes exceeds {limit} bytes")
            }
            Self::SerializationFailed(source) => {
                format!("failed to serialize app-server message: {source}")
            }
            Self::ReadFailed(source) => format!("failed to read app-server output: {source}"),
        }
    }
}

impl fmt::Display for HostError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}", self.message())
    }
}

impl Error for HostError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::SpawnFailed { source, .. } => Some(source),
            Self::WriteFailed(source) | Self::FlushFailed(source) => Some(source),
            Self::SerializationFailed(source) => Some(source),
            Self::ReadFailed(source) => Some(source),
            _ => None,
        }
    }
}

impl From<io::Error> for HostError {
    fn from(source: io::Error) -> Self {
        Self::WriteFailed(source)
    }
}

#[derive(Serialize)]
struct ErrorPayload<'a> {
    kind: &'a str,
    message: String,
    retryable: bool,
}

impl Serialize for HostError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        ErrorPayload {
            kind: self.kind(),
            message: self.message(),
            retryable: self.retryable(),
        }
        .serialize(serializer)
    }
}

pub type HostResult<T> = Result<T, HostError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_structured_spawn_error() {
        let error = HostError::SpawnFailed {
            binary: PathBuf::from("/missing/codex"),
            source: io::Error::new(io::ErrorKind::NotFound, "not found"),
        };
        let payload: serde_json::Value = serde_json::to_value(&error).unwrap();

        assert_eq!(payload["kind"], "spawnFailed");
        assert_eq!(payload["retryable"], false);
        assert!(payload["message"]
            .as_str()
            .unwrap()
            .starts_with("unable to spawn"));
    }

    #[test]
    fn transport_errors_are_retryable() {
        assert!(HostError::TransportClosed.retryable());
        assert!(!HostError::RuntimeNotReady.retryable());
    }
}
