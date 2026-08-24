mod config;
mod error;

use serde_json::{json, Value};
use std::time::Duration;
use std::{
    process::Stdio,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{AppHandle, Emitter, State};
use tokio::{
    io::{AsyncWriteExt, BufReader},
    process::{Child, ChildStdin},
    sync::Mutex as AsyncMutex,
    time::timeout,
};

use crate::{
    config::RuntimeConfig,
    error::{HostError, HostResult},
    transport::{codec, FrameCodec, RequestManager},
};

mod transport;

struct Inner {
    child: AsyncMutex<Option<Child>>,
    stdin: AsyncMutex<Option<ChildStdin>>,
    requests: Mutex<RequestManager>,
    ready: AtomicBool,
    config: RuntimeConfig,
}

#[derive(Clone)]
struct AppServerState(Arc<Inner>);

impl AppServerState {
    fn new(config: RuntimeConfig) -> Self {
        Self(Arc::new(Inner {
            child: AsyncMutex::new(None),
            stdin: AsyncMutex::new(None),
            requests: Mutex::new(RequestManager::default()),
            ready: AtomicBool::new(false),
            config,
        }))
    }
}

async fn ensure_started(state: &AppServerState, app: &AppHandle) -> HostResult<()> {
    let codec = FrameCodec::new(state.0.config.max_frame_bytes);
    let mut child_guard = state.0.child.lock().await;
    if state.0.ready.load(Ordering::Acquire) && child_guard.is_some() {
        return Ok(());
    }

    let mut command = state.0.config.command();
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .kill_on_drop(true);

    let mut child = command.spawn().map_err(|source| HostError::SpawnFailed {
        binary: state.0.config.program.clone(),
        source,
    })?;

    let stdin = child
        .stdin
        .take()
        .ok_or(HostError::StdioUnavailable("stdin"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or(HostError::StdioUnavailable("stdout"))?;
    *child_guard = Some(child);
    *state.0.stdin.lock().await = Some(stdin);
    state.0.ready.store(true, Ordering::Release);

    let reader_state = state.clone();
    let emitter = app.clone();
    let _ = emitter.emit(
        "protocol://supervisor",
        json!({
            "type": "supervisor",
            "state": "starting",
        }),
    );

    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        let mut transport_error: Option<HostError> = None;

        loop {
            match codec.read(&mut reader).await {
                Ok(Some(frame)) => match frame {
                    codec::DecodedFrame::Message(message) => {
                        handle_message(&reader_state, &emitter, message);
                    }
                    codec::DecodedFrame::InvalidFrame { reason, preview } => {
                        eprintln!("invalid app-server frame ({reason}): {preview}");
                    }
                    codec::DecodedFrame::OversizedFrame { length } => {
                        eprintln!("discarded oversized app-server frame: {length} bytes");
                    }
                },
                Ok(None) => break,
                Err(error) => {
                    transport_error = Some(error);
                    break;
                }
            }
        }

        reader_state.0.ready.store(false, Ordering::Release);
        if let Ok(mut requests) = reader_state.0.requests.lock() {
            requests.fail_all(transport_error.unwrap_or(HostError::TransportClosed));
        }

        let exit = {
            let mut child_guard = reader_state.0.child.lock().await;
            match child_guard.as_mut() {
                Some(child) => child.wait().await.ok(),
                None => None,
            }
        };
        let _ = emitter.emit(
            "protocol://supervisor",
            json!({
                "type": "supervisor",
                "state": exit
                    .map(|status| if status.success() { "stopped" } else { "failed" })
                    .unwrap_or("failed"),
                "detail": exit
                    .map(|status| json!({
                        "code": status.code(),
                        "success": status.success(),
                    }))
                    .unwrap_or(Value::Null),
            }),
        );
    });

    Ok(())
}

async fn send_request(
    state: &AppServerState,
    app: &AppHandle,
    method: String,
    params: Value,
) -> HostResult<Value> {
    ensure_started(state, app).await?;
    let registered = {
        let mut requests = state
            .0
            .requests
            .lock()
            .map_err(|_| HostError::PendingStatePoisoned)?;
        requests.register(method.clone())
    };
    let request = json!({
        "jsonrpc": "2.0",
        "id": registered.id,
        "method": method,
        "params": params,
    });
    write_message(state, &request).await?;

    let request_timeout = if method == "initialize" {
        state.0.config.initialize_timeout_ms
    } else {
        state.0.config.request_timeout_ms
    };

    match timeout(Duration::from_millis(request_timeout), registered.receiver).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err(HostError::TransportClosed),
        Err(_) => {
            if let Ok(mut requests) = state.0.requests.lock() {
                requests.timed_out(Duration::from_millis(request_timeout));
            }
            Err(HostError::Timeout { method })
        }
    }
}

#[tauri::command]
async fn app_server_start(state: State<'_, AppServerState>, app: AppHandle) -> HostResult<()> {
    ensure_started(&state, &app).await
}

#[tauri::command]
async fn app_server_request(
    state: State<'_, AppServerState>,
    app: AppHandle,
    method: String,
    params: Option<Value>,
) -> HostResult<Value> {
    send_request(&state, &app, method, params.unwrap_or_else(|| json!({}))).await
}

#[tauri::command]
async fn app_server_resolve(
    state: State<'_, AppServerState>,
    id: Value,
    result: Value,
) -> HostResult<()> {
    write_message(
        &state,
        &json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": result,
        }),
    )
    .await
}

async fn write_message(state: &AppServerState, value: &Value) -> HostResult<()> {
    let mut stdin_guard = state.0.stdin.lock().await;
    let stdin = stdin_guard.as_mut().ok_or(HostError::RuntimeNotReady)?;
    let codec = FrameCodec::new(state.0.config.max_frame_bytes);
    let frame = codec.encode(value)?;
    stdin
        .write_all(&frame)
        .await
        .map_err(HostError::WriteFailed)?;
    stdin.flush().await.map_err(HostError::FlushFailed)?;
    Ok(())
}

fn handle_message(state: &AppServerState, emitter: &AppHandle, message: Value) {
    let request_id = message.get("id").and_then(Value::as_u64);

    if let Some(id) = request_id {
        let mut handled = false;
        if let Ok(mut requests) = state.0.requests.lock() {
            if let Some(error) = message.get("error") {
                handled = requests.reject_runtime_failure(id, error.to_string());
            } else {
                handled =
                    requests.resolve(id, message.get("result").cloned().unwrap_or(Value::Null));
            }
        }

        if handled || message.get("method").is_none() {
            return;
        }
    }

    if let Some(method) = message.get("method") {
        let channel = if message.get("id").is_some() {
            "protocol://server-request"
        } else {
            "protocol://notification"
        };
        let _ = emitter.emit(
            channel,
            json!({
                "method": method,
                "params": message.get("params"),
                "id": message.get("id"),
            }),
        );
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppServerState::new(RuntimeConfig::from_env()))
        .invoke_handler(tauri::generate_handler![
            app_server_start,
            app_server_request,
            app_server_resolve
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Sunlab Codex Desktop");
}
