use std::{
    collections::HashMap,
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, Instant},
};

use serde_json::Value;
use tokio::sync::oneshot;

use crate::error::HostError;

struct PendingRequest {
    sender: oneshot::Sender<Result<Value, HostError>>,
    method: String,
    started_at: Instant,
}

#[derive(Default)]
pub struct RequestManager {
    next_id: AtomicU64,
    pending: HashMap<u64, PendingRequest>,
}

impl RequestManager {
    pub fn register(&mut self, method: impl Into<String>) -> RegisteredRequest {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = oneshot::channel();
        self.pending.insert(
            id,
            PendingRequest {
                sender,
                method: method.into(),
                started_at: Instant::now(),
            },
        );

        RegisteredRequest { id, receiver }
    }

    pub fn resolve(&mut self, id: u64, result: Value) -> bool {
        match self.take_pending(id) {
            Some(pending) => pending.sender.send(Ok(result)).is_ok(),
            None => false,
        }
    }

    pub fn reject_runtime_failure(&mut self, id: u64, message: impl Into<String>) -> bool {
        match self.take_pending(id) {
            Some(pending) => pending
                .sender
                .send(Err(HostError::RuntimeFailure(message.into())))
                .is_ok(),
            None => false,
        }
    }

    fn take_pending(&mut self, id: u64) -> Option<PendingRequest> {
        self.pending.remove(&id)
    }

    pub fn fail_all(&mut self, error: HostError) -> usize {
        let ids: Vec<u64> = self.pending.keys().copied().collect();
        let mut failed = 0usize;
        for id in ids {
            let Some(pending) = self.pending.remove(&id) else {
                continue;
            };
            failed += 1;
            let _ = pending.sender.send(Err(match &error {
                HostError::TransportClosed => HostError::TransportClosed,
                HostError::RuntimeNotReady => HostError::RuntimeNotReady,
                _ => HostError::TransportClosed,
            }));
        }
        failed
    }

    pub fn timed_out(&mut self, timeout: Duration) -> Vec<HostError> {
        let ids: Vec<u64> = self
            .pending
            .iter()
            .filter(|(_, pending)| pending.started_at.elapsed() >= timeout)
            .map(|(id, _)| *id)
            .collect();

        let mut results = Vec::new();
        for id in ids {
            let Some(pending) = self.pending.remove(&id) else {
                continue;
            };
            let method = pending.method;
            results.push(HostError::Timeout {
                method: method.clone(),
            });
            let _ = pending.sender.send(Err(HostError::Timeout { method }));
        }
        results
    }
}

pub struct RegisteredRequest {
    pub id: u64,
    pub receiver: oneshot::Receiver<Result<Value, HostError>>,
}

#[cfg(test)]
impl RequestManager {
    fn is_empty(&self) -> bool {
        self.pending.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registers_monotonic_ids_and_resolves_requests() {
        let mut manager = RequestManager::default();
        let first = manager.register("initialize");
        let second = manager.register("thread/start");

        assert_eq!(first.id, 0);
        assert_eq!(second.id, 1);

        assert!(manager.resolve(first.id, serde_json::json!({"ok":true})));
        let result = first.receiver.blocking_recv().unwrap().unwrap();
        assert_eq!(result, serde_json::json!({"ok":true}));
        assert!(!manager.resolve(first.id, serde_json::json!({})));
    }

    #[test]
    fn fail_all_terminates_every_pending_request() {
        let mut manager = RequestManager::default();
        let first = manager.register("turn/start");
        let second = manager.register("thread/read");

        let failed = manager.fail_all(HostError::TransportClosed);
        assert_eq!(failed, 2);
        assert!(manager.is_empty());

        for receiver in [first.receiver, second.receiver] {
            let error = receiver.blocking_recv().unwrap().unwrap_err();
            assert!(matches!(error, HostError::TransportClosed));
        }
    }

    #[tokio::test]
    async fn sweeps_timed_out_requests() {
        let mut manager = RequestManager::default();
        let registered = manager.register("turn/start");

        tokio::time::sleep(Duration::from_millis(10)).await;
        let timed_out = manager.timed_out(Duration::from_millis(5));

        assert_eq!(timed_out.len(), 1);
        assert!(matches!(
            timed_out[0],
            HostError::Timeout { ref method } if method == "turn/start"
        ));
        let error = registered.receiver.await.unwrap().unwrap_err();
        assert!(matches!(error, HostError::Timeout { .. }));
    }
}
