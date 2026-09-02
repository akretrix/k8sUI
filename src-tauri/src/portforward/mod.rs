use crate::connector::{ActivePortForward, ConnectorError};
use k8s_openapi::api::core::v1::Pod;
use kube::api::Api;
use kube::Client;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::{oneshot, Mutex};

pub struct PortForwardManager {
    tunnels: Arc<Mutex<HashMap<String, oneshot::Sender<()>>>>,
    active_list: Arc<Mutex<Vec<ActivePortForward>>>,
}

impl Default for PortForwardManager {
    fn default() -> Self {
        Self::new()
    }
}

impl PortForwardManager {
    pub fn new() -> Self {
        Self {
            tunnels: Arc::new(Mutex::new(HashMap::new())),
            active_list: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Spawns a native port-forward stream using kube-rs
    pub async fn start_port_forward(
        &self,
        client: Client,
        namespace: &str,
        pod_name: &str,
        target_port: u16,
        local_port: u16,
    ) -> Result<ActivePortForward, ConnectorError> {
        let session_id = format!("pf-{}-{}-{}", namespace, pod_name, target_port);
        let (stop_tx, mut stop_rx) = oneshot::channel::<()>();

        let pod_api: Api<Pod> = Api::namespaced(client.clone(), namespace);

        let addr = format!("127.0.0.1:{}", local_port);
        let listener = TcpListener::bind(&addr).await.map_err(|e| {
            ConnectorError::PortForwardError(format!(
                "Failed to bind local port {}: {}",
                local_port, e
            ))
        })?;

        let pod_name_owned = pod_name.to_string();
        let target_port_owned = target_port;
        let session_id_clone = session_id.clone();

        tokio::spawn(async move {
            tokio::select! {
                _ = &mut stop_rx => {
                    tracing::info!("Port-forward {} stopped by user", session_id_clone);
                }
                _ = async {
                    while let Ok((mut stream, _)) = listener.accept().await {
                        let mut forwarder = match pod_api.portforward(&pod_name_owned, &[target_port_owned]).await {
                            Ok(pf) => pf,
                            Err(e) => {
                                tracing::error!("Failed to create port-forward stream: {}", e);
                                break;
                            }
                        };

                        if let Some(mut upstream) = forwarder.take_stream(target_port_owned) {
                            tokio::spawn(async move {
                                let _ = tokio::io::copy_bidirectional(&mut stream, &mut upstream).await;
                            });
                        }
                    }
                } => {}
            }
        });

        let forward_info = ActivePortForward {
            session_id: session_id.clone(),
            namespace: namespace.to_string(),
            pod_name: pod_name.to_string(),
            container_port: target_port,
            local_port,
            status: "active".to_string(),
        };

        let mut map = self.tunnels.lock().await;
        map.insert(session_id, stop_tx);

        let mut list = self.active_list.lock().await;
        list.push(forward_info.clone());

        Ok(forward_info)
    }

    pub async fn stop_port_forward(&self, session_id: &str) -> Result<(), ConnectorError> {
        let mut map = self.tunnels.lock().await;
        if let Some(sender) = map.remove(session_id) {
            let _ = sender.send(());
        }

        let mut list = self.active_list.lock().await;
        list.retain(|p| p.session_id != session_id);

        Ok(())
    }

    pub async fn list_active(&self) -> Vec<ActivePortForward> {
        let list = self.active_list.lock().await;
        list.clone()
    }
}
