//! WatchManager — Kubernetes watch-stream event bridge.
//!
//! Instead of the frontend polling `list_pods` every N seconds, this module
//! maintains one persistent `kube::runtime::watcher` per resource type and
//! pushes change events to the frontend via Tauri's event system.
//!
//! Architecture:
//!   kube API server ──(Watch stream)──► WatchManager task ──► app_handle.emit(...)
//!                                                                       │
//!                                              ┌────────────────────────┘
//!                                              ▼
//!                                     React usePodWatch() hook
//!                                     (listen for "pods:applied" / "pods:deleted")
//!
//! Events emitted:
//!   "pods:applied"     — payload: PodSummary   (insert or update)
//!   "pods:deleted"     — payload: PodRef       (name + namespace)
//!   "pods:watch_ready" — payload: ()            (watch connected)
//!   "pods:watch_error" — payload: String        (non-fatal; watch restarts)

use crate::connector::{ContainerStatusSummary, PodSummary};
use futures::{StreamExt, TryStreamExt};
use k8s_openapi::api::core::v1::Pod;
use kube::{
    api::Api,
    runtime::{watcher, WatchStreamExt},
    Client, ResourceExt,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

// ---------------------------------------------------------------------------
// Public payload types (serialized over IPC)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodRef {
    pub name: String,
    pub namespace: String,
}

// ---------------------------------------------------------------------------
// WatchManager
// ---------------------------------------------------------------------------

/// Manages long-running watch tasks for Kubernetes resources.
///
/// One `CancellationToken` per resource type lets us stop all watches when the
/// user switches clusters or disconnects — without killing the whole async runtime.
pub struct WatchManager {
    /// Tokens for the currently active pod watches (applied + delete).
    /// `None` when no watch is running.
    pod_watch_tokens: Arc<RwLock<Option<(CancellationToken, CancellationToken)>>>,
}

impl WatchManager {
    pub fn new() -> Self {
        Self {
            pod_watch_tokens: Arc::new(RwLock::new(None)),
        }
    }

    /// Start a cluster-wide pod watch on the given `client`, emitting events
    /// through `app_handle`. Cancels any previously active pod watch first.
    ///
    /// The watch runs in two background tokio tasks:
    ///   1. applied_objects stream — handles ADD and MODIFY events
    ///   2. raw watcher stream    — handles DELETE events
    ///
    /// If either stream errors it restarts after a 2-second backoff (handles
    /// transient network issues and SSO token refreshes transparently).
    pub async fn start_pod_watch(&self, app_handle: AppHandle, client: Client) {
        // Cancel any existing watches before starting new ones.
        self.stop_pod_watch().await;

        let apply_token = CancellationToken::new();
        let delete_token = CancellationToken::new();

        {
            let mut guard = self.pod_watch_tokens.write().await;
            *guard = Some((apply_token.clone(), delete_token.clone()));
        }

        // Task 1: applied events (add + modify)
        {
            let handle = app_handle.clone();
            let c = client.clone();
            let token = apply_token;
            tokio::spawn(async move {
                pod_apply_watch_loop(handle, c, token).await;
            });
        }

        // Task 2: delete events
        {
            let handle = app_handle;
            let c = client;
            let token = delete_token;
            tokio::spawn(async move {
                pod_delete_watch_loop(handle, c, token).await;
            });
        }
    }

    /// Cancel the active pod watch (if any). Returns immediately; the
    /// background tasks drain and exit within one poll cycle.
    pub async fn stop_pod_watch(&self) {
        let mut guard = self.pod_watch_tokens.write().await;
        if let Some((apply_tok, delete_tok)) = guard.take() {
            apply_tok.cancel();
            delete_tok.cancel();
        }
    }

    /// Stop all watches (called when the user disconnects from a cluster).
    pub async fn stop_all(&self) {
        self.stop_pod_watch().await;
    }

    /// Returns true if a pod watch is currently active.
    pub async fn is_pod_watch_running(&self) -> bool {
        let guard = self.pod_watch_tokens.read().await;
        guard.is_some()
    }
}

impl Default for WatchManager {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Applied-event watch loop
// ---------------------------------------------------------------------------

/// Runs the applied pod watch loop until `cancel` is triggered.
///
/// `applied_objects()` yields items on ADD and MODIFY events only.
async fn pod_apply_watch_loop(app_handle: AppHandle, client: Client, cancel: CancellationToken) {
    loop {
        if cancel.is_cancelled() {
            break;
        }

        tracing::info!("[WatchManager] Starting cluster-wide pod apply-watch");

        let api: Api<Pod> = Api::all(client.clone());
        let watcher_config = watcher::Config::default();
        let mut stream = watcher(api, watcher_config).applied_objects().boxed();

        // Emit "ready" so the frontend knows the watch stream is live
        let _ = app_handle.emit("pods:watch_ready", ());

        loop {
            tokio::select! {
                _ = cancel.cancelled() => {
                    tracing::info!("[WatchManager] Pod apply-watch cancelled");
                    return;
                }
                event = stream.try_next() => {
                    match event {
                        Ok(Some(pod)) => {
                            if let Some(summary) = pod_to_summary(pod) {
                                let _ = app_handle.emit("pods:applied", summary);
                            }
                        }
                        Ok(None) => {
                            tracing::warn!("[WatchManager] Pod apply-watch stream ended, restarting…");
                            break;
                        }
                        Err(e) => {
                            tracing::warn!("[WatchManager] Pod apply-watch error: {:?}", e);
                            let _ = app_handle.emit("pods:watch_error", e.to_string());
                            break;
                        }
                    }
                }
            }
        }

        // Brief backoff before reconnect
        if !cancel.is_cancelled() {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }
    }
}

// ---------------------------------------------------------------------------
// Delete-event watch loop
// ---------------------------------------------------------------------------

/// Runs a delete-detection watch loop until `cancel` is triggered.
///
/// Uses the raw watcher stream (not `applied_objects()`) so we see Deleted events.
async fn pod_delete_watch_loop(app_handle: AppHandle, client: Client, cancel: CancellationToken) {
    loop {
        if cancel.is_cancelled() {
            break;
        }

        tracing::info!("[WatchManager] Starting cluster-wide pod delete-watch");

        let api: Api<Pod> = Api::all(client.clone());
        let watcher_config = watcher::Config::default();
        let mut stream = watcher(api, watcher_config).boxed();

        loop {
            tokio::select! {
                _ = cancel.cancelled() => {
                    tracing::info!("[WatchManager] Pod delete-watch cancelled");
                    return;
                }
                event = stream.try_next() => {
                    match event {
                        Ok(Some(watcher::Event::Delete(pod))) => {
                            let name = pod.name_any();
                            let namespace = pod
                                .metadata
                                .namespace
                                .unwrap_or_else(|| "default".to_string());
                            let _ = app_handle.emit("pods:deleted", PodRef { name, namespace });
                        }
                        Ok(Some(_)) => {
                            // Applied / InitApply / RestartApply handled by sibling stream
                        }
                        Ok(None) => {
                            tracing::warn!("[WatchManager] Pod delete-watch stream ended, restarting…");
                            break;
                        }
                        Err(e) => {
                            tracing::warn!("[WatchManager] Pod delete-watch error: {:?}", e);
                            break;
                        }
                    }
                }
            }
        }

        if !cancel.is_cancelled() {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }
    }
}

// ---------------------------------------------------------------------------
// Pod → PodSummary conversion (mirrors resource_manager.rs list_pods logic)
// ---------------------------------------------------------------------------

fn pod_to_summary(pod: Pod) -> Option<PodSummary> {
    let meta = pod.metadata;
    let name = meta.name?;
    let ns = meta.namespace.unwrap_or_else(|| "default".to_string());
    let status_obj = pod.status.unwrap_or_default();
    let phase = status_obj.phase.unwrap_or_else(|| "Unknown".to_string());
    let container_statuses = status_obj.container_statuses.unwrap_or_default();
    let total = container_statuses.len();
    let ready = container_statuses.iter().filter(|c| c.ready).count();
    let restarts: i32 = container_statuses.iter().map(|c| c.restart_count).sum();

    let created_at_str = meta.creation_timestamp.as_ref().map(|t| t.0.to_rfc3339());
    let age_str = if let Some(created) = meta.creation_timestamp.as_ref() {
        let dur = chrono::Utc::now().signed_duration_since(created.0);
        if dur.num_days() > 0 {
            format!("{}d", dur.num_days())
        } else if dur.num_hours() > 0 {
            format!("{}h", dur.num_hours())
        } else if dur.num_minutes() > 0 {
            format!("{}m", dur.num_minutes())
        } else {
            format!("{}s", dur.num_seconds())
        }
    } else {
        "-".to_string()
    };

    let mut container_list: Vec<ContainerStatusSummary> = Vec::new();
    for cs in &container_statuses {
        let state_str = if cs.state.as_ref().and_then(|s| s.running.as_ref()).is_some() {
            "running".to_string()
        } else if let Some(w) = cs.state.as_ref().and_then(|s| s.waiting.as_ref()) {
            w.reason.clone().unwrap_or_else(|| "waiting".to_string())
        } else if let Some(t) = cs.state.as_ref().and_then(|s| s.terminated.as_ref()) {
            t.reason.clone().unwrap_or_else(|| "terminated".to_string())
        } else {
            "unknown".to_string()
        };
        let reason_str = cs.state.as_ref().and_then(|s| {
            s.waiting
                .as_ref()
                .and_then(|w| w.reason.clone())
                .or_else(|| s.terminated.as_ref().and_then(|t| t.reason.clone()))
        });
        container_list.push(ContainerStatusSummary {
            name: cs.name.clone(),
            ready: cs.ready,
            state: state_str,
            reason: reason_str,
        });
    }

    Some(PodSummary {
        name,
        namespace: ns,
        ready_containers: format!("{}/{}", ready, total),
        status: phase,
        restarts,
        age: age_str,
        // CPU/Memory are not available via the watch stream (those come from
        // the metrics-server which has no watch API). They are hydrated by the
        // initial list_pods call and overlaid by the periodic metrics refresh.
        cpu: None,
        memory: None,
        node: pod.spec.and_then(|s| s.node_name),
        containers: Some(container_list),
        created_at: created_at_str,
    })
}
