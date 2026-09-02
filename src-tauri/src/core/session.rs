use crate::connector::{ClusterConnector, ClusterContextSummary, ConnectorError};
use crate::core::resource_manager::GenericResourceManager;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct SessionManager {
    active_connector: Arc<RwLock<Option<Arc<dyn ClusterConnector>>>>,
    active_summary: Arc<RwLock<Option<ClusterContextSummary>>>,
    connectors: Arc<RwLock<HashMap<String, Arc<dyn ClusterConnector>>>>,
    summaries: Arc<RwLock<HashMap<String, ClusterContextSummary>>>,
    available_clusters: Arc<RwLock<Vec<ClusterContextSummary>>>,
    is_write_mode_unlocked: Arc<RwLock<bool>>,
    current_namespace: Arc<RwLock<Option<String>>>,
    resource_managers: Arc<RwLock<HashMap<String, Arc<GenericResourceManager>>>>,
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            active_connector: Arc::new(RwLock::new(None)),
            active_summary: Arc::new(RwLock::new(None)),
            connectors: Arc::new(RwLock::new(HashMap::new())),
            summaries: Arc::new(RwLock::new(HashMap::new())),
            available_clusters: Arc::new(RwLock::new(Vec::new())),
            is_write_mode_unlocked: Arc::new(RwLock::new(false)),
            current_namespace: Arc::new(RwLock::new(None)),
            resource_managers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn set_available_clusters(&self, clusters: Vec<ClusterContextSummary>) {
        let mut write = self.available_clusters.write().await;
        *write = clusters;
    }

    pub async fn get_available_clusters(&self) -> Vec<ClusterContextSummary> {
        let read = self.available_clusters.read().await;
        read.clone()
    }

    pub async fn set_active_connector(
        &self,
        connector: Arc<dyn ClusterConnector>,
        summary: ClusterContextSummary,
    ) {
        let id = summary.id.clone();

        {
            let mut conn_map = self.connectors.write().await;
            conn_map.insert(id.clone(), connector.clone());
        }

        {
            let mut sum_map = self.summaries.write().await;
            sum_map.insert(id.clone(), summary.clone());
        }

        {
            let mut conn_write = self.active_connector.write().await;
            *conn_write = Some(connector);
        }

        {
            let mut sum_write = self.active_summary.write().await;
            *sum_write = Some(summary);
        }

        // Security invariant: Reset write mode back to FALSE (read-only) upon switching clusters
        let mut write_mode = self.is_write_mode_unlocked.write().await;
        *write_mode = false;
    }

    /// The resource manager for the given cluster (or active cluster if None),
    /// building and caching it per cluster ID so discovery walks run once per cluster.
    pub async fn get_resource_manager_for(
        &self,
        cluster_id: Option<&str>,
    ) -> Result<Arc<GenericResourceManager>, ConnectorError> {
        let target_id = match cluster_id {
            Some(id) => id.to_string(),
            None => {
                let active = self.get_active_summary().await;
                match active {
                    Some(s) => s.id,
                    None => "default".to_string(),
                }
            }
        };

        {
            let read_mgrs = self.resource_managers.read().await;
            if let Some(mgr) = read_mgrs.get(&target_id) {
                return Ok(mgr.clone());
            }
        }

        let connector = self.get_connector_for(Some(&target_id)).await?;
        let client = connector.get_client().await?;
        let mgr = Arc::new(GenericResourceManager::new(client));

        {
            let mut write_mgrs = self.resource_managers.write().await;
            write_mgrs.insert(target_id, mgr.clone());
        }

        Ok(mgr)
    }

    pub async fn get_resource_manager(
        &self,
    ) -> Result<Arc<GenericResourceManager>, ConnectorError> {
        self.get_resource_manager_for(None).await
    }

    pub async fn invalidate_resource_manager_for(&self, cluster_id: &str) {
        let mut write = self.resource_managers.write().await;
        write.remove(cluster_id);
    }

    pub async fn invalidate_resource_manager(&self) {
        let mut write = self.resource_managers.write().await;
        write.clear();
    }

    pub async fn get_connector_for(
        &self,
        cluster_id: Option<&str>,
    ) -> Result<Arc<dyn ClusterConnector>, ConnectorError> {
        if let Some(id) = cluster_id {
            let conn_map = self.connectors.read().await;
            if let Some(conn) = conn_map.get(id) {
                return Ok(conn.clone());
            }
        }

        let read = self.active_connector.read().await;
        read.as_ref().cloned().ok_or_else(|| {
            ConnectorError::ConnectionError("No active cluster connection".to_string())
        })
    }

    pub async fn get_active_connector(&self) -> Result<Arc<dyn ClusterConnector>, ConnectorError> {
        self.get_connector_for(None).await
    }

    pub async fn get_active_summary(&self) -> Option<ClusterContextSummary> {
        let read = self.active_summary.read().await;
        read.clone()
    }

    pub async fn is_read_only(&self) -> bool {
        let read = self.is_write_mode_unlocked.read().await;
        !*read
    }

    pub async fn set_write_mode_unlocked(&self, unlocked: bool) {
        let mut write = self.is_write_mode_unlocked.write().await;
        *write = unlocked;
    }

    pub async fn set_namespace(&self, ns: Option<String>) {
        let mut write = self.current_namespace.write().await;
        *write = ns;
    }

    pub async fn get_namespace(&self) -> Option<String> {
        let read = self.current_namespace.read().await;
        read.clone()
    }
}
