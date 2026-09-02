use crate::connector::ConnectorError;

use futures::channel::mpsc as futures_mpsc;
use futures::SinkExt;
use k8s_openapi::api::core::v1::Pod;
use kube::api::{Api, AttachParams};
use kube::Client;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};

pub struct TerminalSession {
    pub session_id: String,
    pub pod_name: String,
    pub namespace: String,
    pub container: Option<String>,
    pub input_tx: mpsc::Sender<Vec<u8>>,
    pub resize_tx: Option<futures_mpsc::Sender<kube::api::TerminalSize>>,
}

pub struct TerminalManager {
    sessions: Arc<Mutex<std::collections::HashMap<String, TerminalSession>>>,
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    /// Spawns a native Kubernetes exec subresource session via kube-rs (SPDY/WebSocket)
    #[allow(clippy::too_many_arguments)]
    pub async fn spawn_exec(
        &self,
        client: Client,
        namespace: &str,
        pod_name: &str,
        container: Option<&str>,
        cmd: Vec<&str>,
        cols: Option<u16>,
        rows: Option<u16>,
        output_tx: mpsc::Sender<Vec<u8>>,
    ) -> Result<String, ConnectorError> {
        let session_id = format!("term-{}", chrono::Utc::now().timestamp_millis());
        let (input_tx, mut input_rx) = mpsc::channel::<Vec<u8>>(128);

        let pod_api: Api<Pod> = Api::namespaced(client, namespace);
        // Confirmed against a live cluster: requesting tty(true) and stderr(true)
        // together fails validation before the request is even sent — the
        // Kubernetes exec API multiplexes stdout+stderr into one stream under a
        // TTY, so asking for a separate stderr stream on top is a contradiction
        // it rejects outright. Every exec session failed with the identical
        // error until this was split; an interactive shell doesn't need a
        // separate stderr channel anyway (it renders inline like a real terminal).
        let mut attach_params = AttachParams::default()
            .stdin(true)
            .stdout(true)
            .stderr(false) // AttachParams::default() defaults this to true — must be turned off explicitly, not just left unset, or the tty/stderr conflict below still fires.
            .tty(true);

        if let Some(c) = container {
            attach_params = attach_params.container(c);
        }

        let candidate_commands: Vec<Vec<String>> = if cmd.is_empty() {
            vec![
                vec![
                    "/bin/sh".to_string(),
                    "-c".to_string(),
                    "export TERM=xterm-256color; command -v bash >/dev/null 2>&1 && exec bash -l || (command -v sh >/dev/null 2>&1 && exec sh -l || exec /bin/sh)".to_string(),
                ],
                vec!["/bin/bash".to_string(), "-l".to_string()],
                vec!["/bin/bash".to_string()],
                vec!["/bin/sh".to_string()],
                vec!["/bin/ash".to_string()],
                vec!["bash".to_string()],
                vec!["sh".to_string()],
            ]
        } else {
            vec![cmd.into_iter().map(|s| s.to_string()).collect()]
        };

        let mut last_err = None;
        let mut attached_opt = None;

        for try_cmd in candidate_commands {
            match pod_api.exec(pod_name, try_cmd, &attach_params).await {
                Ok(att) => {
                    attached_opt = Some(att);
                    break;
                }
                Err(e) => {
                    last_err = Some(e);
                }
            }
        }

        let mut attached = match attached_opt {
            Some(a) => a,
            None => {
                return Err(ConnectorError::TerminalError(format!(
                    "Exec attach failed: {}",
                    last_err
                        .map(|e| e.to_string())
                        .unwrap_or_else(|| "No matching shell found in container".to_string())
                )))
            }
        };

        // Pipe stdout back to frontend
        if let Some(mut stdout) = attached.stdout() {
            let tx = output_tx.clone();
            tokio::spawn(async move {
                let mut buffer = [0u8; 1024];
                use tokio::io::AsyncReadExt;
                while let Ok(n) = stdout.read(&mut buffer).await {
                    if n == 0 {
                        break;
                    }
                    let _ = tx.send(buffer[..n].to_vec()).await;
                }
            });
        }

        // Pipe frontend stdin input into attached process
        if let Some(mut stdin) = attached.stdin() {
            tokio::spawn(async move {
                use tokio::io::AsyncWriteExt;
                while let Some(bytes) = input_rx.recv().await {
                    let _ = stdin.write_all(&bytes).await;
                    let _ = stdin.flush().await;
                }
            });
        }

        let mut resize_tx = attached.terminal_size();
        if let (Some(tx), Some(w), Some(h)) = (&mut resize_tx, cols, rows) {
            let _ = tx
                .send(kube::api::TerminalSize {
                    width: w,
                    height: h,
                })
                .await;
        }

        let session = TerminalSession {
            session_id: session_id.clone(),
            pod_name: pod_name.to_string(),
            namespace: namespace.to_string(),
            container: container.map(|c| c.to_string()),
            input_tx,
            resize_tx,
        };

        let mut map = self.sessions.lock().await;
        map.insert(session_id.clone(), session);

        Ok(session_id)
    }

    pub async fn write_input(&self, session_id: &str, data: Vec<u8>) -> Result<(), ConnectorError> {
        let map = self.sessions.lock().await;
        if let Some(session) = map.get(session_id) {
            session
                .input_tx
                .send(data)
                .await
                .map_err(|e| ConnectorError::TerminalError(e.to_string()))?;
            Ok(())
        } else {
            Err(ConnectorError::TerminalError(format!(
                "Session {} not found",
                session_id
            )))
        }
    }

    pub async fn resize(
        &self,
        session_id: &str,
        cols: u16,
        rows: u16,
    ) -> Result<(), ConnectorError> {
        let mut map = self.sessions.lock().await;
        if let Some(session) = map.get_mut(session_id) {
            if let Some(tx) = &mut session.resize_tx {
                // In kube-rs 0.93, TerminalSize expects width/height
                let _ = tx
                    .send(kube::api::TerminalSize {
                        width: cols,
                        height: rows,
                    })
                    .await;
            }
            Ok(())
        } else {
            Err(ConnectorError::TerminalError(format!(
                "Session {} not found",
                session_id
            )))
        }
    }

    pub async fn close_session(&self, session_id: &str) {
        let mut map = self.sessions.lock().await;
        map.remove(session_id);
    }
}
