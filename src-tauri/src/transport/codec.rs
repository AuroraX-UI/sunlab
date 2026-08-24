use serde_json::Value;
use tokio::io::AsyncBufReadExt;

use crate::error::HostError;

const DEFAULT_MAX_FRAME_BYTES: usize = 16 * 1024 * 1024;
const MAX_PREVIEW_BYTES: usize = 160;

#[derive(Debug, PartialEq)]
pub enum DecodedFrame {
    Message(Value),
    InvalidFrame {
        reason: &'static str,
        preview: String,
    },
    OversizedFrame {
        length: usize,
    },
}

pub struct FrameCodec {
    max_frame_bytes: usize,
}

impl FrameCodec {
    pub fn new(max_frame_bytes: usize) -> Self {
        Self {
            max_frame_bytes: max_frame_bytes.max(1),
        }
    }

    pub fn encode(&self, value: &Value) -> Result<Vec<u8>, HostError> {
        let serialized = serde_json::to_vec(value).map_err(HostError::SerializationFailed)?;
        let frame_length = serialized.len() + 1;
        if frame_length > self.max_frame_bytes {
            return Err(HostError::FrameTooLarge {
                length: frame_length,
                limit: self.max_frame_bytes,
            });
        }

        let mut frame = serialized;
        frame.push(b'\n');
        Ok(frame)
    }

    pub async fn read<R>(&self, reader: &mut R) -> Result<Option<DecodedFrame>, HostError>
    where
        R: tokio::io::AsyncBufRead + Unpin,
    {
        let mut frame_length = 0usize;
        let mut buffer = Vec::new();

        loop {
            let available = reader.fill_buf().await.map_err(HostError::ReadFailed)?;

            if available.is_empty() {
                if frame_length == 0 {
                    return Ok(None);
                }
                break;
            }

            if let Some(newline_position) = available.iter().position(|byte| *byte == b'\n') {
                let chunk = &available[..newline_position];
                let chunk_length = chunk.len();
                frame_length += chunk_length;

                let oversized = frame_length > self.max_frame_bytes;
                if !oversized {
                    buffer.extend_from_slice(chunk);
                }

                reader.consume(newline_position + 1);
                if oversized {
                    return Ok(Some(DecodedFrame::OversizedFrame {
                        length: frame_length,
                    }));
                }

                break;
            }

            let available_length = available.len();
            if frame_length + available_length > self.max_frame_bytes {
                frame_length += available_length;
                reader.consume(available_length);
                self.drain_until_newline(reader).await?;
                return Ok(Some(DecodedFrame::OversizedFrame {
                    length: frame_length,
                }));
            }

            buffer.extend_from_slice(available);
            frame_length += available_length;
            reader.consume(available_length);
        }

        let parsed = serde_json::from_slice::<Value>(&buffer);

        Ok(Some(match parsed {
            Ok(message) => DecodedFrame::Message(message),
            Err(_) => DecodedFrame::InvalidFrame {
                reason: "invalidJson",
                preview: String::from_utf8_lossy(&buffer[..buffer.len().min(MAX_PREVIEW_BYTES)])
                    .into_owned(),
            },
        }))
    }

    async fn drain_until_newline<R>(&self, reader: &mut R) -> Result<(), HostError>
    where
        R: tokio::io::AsyncBufRead + Unpin,
    {
        loop {
            let available = reader.fill_buf().await.map_err(HostError::ReadFailed)?;

            if available.is_empty() {
                return Ok(());
            }

            match available.iter().position(|byte| *byte == b'\n') {
                Some(newline_position) => {
                    reader.consume(newline_position + 1);
                    return Ok(());
                }
                None => {
                    let length = available.len();
                    reader.consume(length);
                }
            }
        }
    }
}

impl Default for FrameCodec {
    fn default() -> Self {
        Self::new(DEFAULT_MAX_FRAME_BYTES)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[tokio::test]
    async fn decodes_multiple_json_frames() {
        let mut cursor =
            Cursor::new(b"{\"id\":1}\n{\"id\":2}\n{\"method\":\"item/started\"}\n".as_slice());
        let codec = FrameCodec::new(1024);

        let first = codec.read(&mut cursor).await.unwrap().unwrap();
        let second = codec.read(&mut cursor).await.unwrap().unwrap();
        let third = codec.read(&mut cursor).await.unwrap().unwrap();
        let end = codec.read(&mut cursor).await.unwrap();

        assert_eq!(first, DecodedFrame::Message(serde_json::json!({"id":1})));
        assert_eq!(second, DecodedFrame::Message(serde_json::json!({"id":2})));
        assert_eq!(
            third,
            DecodedFrame::Message(serde_json::json!({"method":"item/started"}))
        );
        assert_eq!(end, None);
    }

    #[tokio::test]
    async fn reports_invalid_json_without_stopping_stream() {
        let mut cursor = Cursor::new(b"not-json\n{\"ok\":true}\n".as_slice());
        let codec = FrameCodec::new(1024);

        let invalid = codec.read(&mut cursor).await.unwrap().unwrap();
        let valid = codec.read(&mut cursor).await.unwrap().unwrap();

        assert!(matches!(
            invalid,
            DecodedFrame::InvalidFrame {
                reason: "invalidJson",
                ..
            }
        ));
        assert_eq!(valid, DecodedFrame::Message(serde_json::json!({"ok":true})));
    }

    #[tokio::test]
    async fn rejects_oversized_frame_and_continues_after_newline() {
        let oversized = format!("\"{}\"\n", "x".repeat(32));
        let valid = b"{\"ok\":true}\n";
        let mut input = oversized.into_bytes();
        input.extend_from_slice(valid);
        let mut cursor = Cursor::new(input);
        let codec = FrameCodec::new(16);

        let decoded = codec.read(&mut cursor).await.unwrap().unwrap();
        let next = codec.read(&mut cursor).await.unwrap().unwrap();

        assert_eq!(decoded, DecodedFrame::OversizedFrame { length: 34 });
        assert_eq!(next, DecodedFrame::Message(serde_json::json!({"ok":true})));
    }

    #[tokio::test]
    async fn accepts_final_frame_without_newline() {
        let mut cursor = Cursor::new(b"{\"final\":true}".as_slice());
        let codec = FrameCodec::new(1024);

        let decoded = codec.read(&mut cursor).await.unwrap().unwrap();
        assert_eq!(
            decoded,
            DecodedFrame::Message(serde_json::json!({"final":true}))
        );
    }

    #[test]
    fn enforces_outgoing_frame_limit() {
        let codec = FrameCodec::new(16);
        let error = codec
            .encode(&serde_json::json!({"value":"0123456789"}))
            .unwrap_err();

        assert!(matches!(
            error,
            HostError::FrameTooLarge { length, limit } if length > limit && limit == 16
        ));
    }
}
