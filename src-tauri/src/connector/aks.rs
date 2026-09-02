use super::{ClusterConnector, ClusterContextSummary, ConnectorError, EnvironmentTier};
use async_trait::async_trait;
use azure_core::credentials::TokenCredential;
use azure_identity::DefaultAzureCredential;
use kube::{config::Config, Client};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AksConnector {
    cluster_name: String,
    resource_group: String,
    #[allow(dead_code)]
    subscription_id: String,
    cluster_endpoint: String,
    client: Arc<RwLock<Option<Client>>>,
    environment: EnvironmentTier,
}

impl AksConnector {
    pub fn new(
        cluster_name: &str,
        resource_group: &str,
        subscription_id: &str,
        endpoint: &str,
    ) -> Self {
        let environment = EnvironmentTier::from_name(cluster_name);
        Self {
            cluster_name: cluster_name.to_string(),
            resource_group: resource_group.to_string(),
            subscription_id: subscription_id.to_string(),
            cluster_endpoint: endpoint.to_string(),
            client: Arc::new(RwLock::new(None)),
            environment,
        }
    }

    /// Acquire short-lived Azure AD token using official azure_identity credential flow
    pub async fn generate_aad_token(&self) -> Result<String, ConnectorError> {
        let credential = DefaultAzureCredential::new().map_err(|e| {
            ConnectorError::AuthError(format!("Failed to create Azure credential chain: {}", e))
        })?;
        // Server Application ID for Azure Kubernetes Service AAD Server
        let scopes = &["6dae42f6-4360-4794-a3e0-dd704400e786/.default"];

        let token_response = credential.get_token(scopes).await.map_err(|e| {
            ConnectorError::AuthError(format!("Azure AD token acquisition failed: {}", e))
        })?;

        Ok(token_response.token.secret().to_string())
    }

    // Retained for the cloud-auth work: this is where a SigV4-presigned STS
    // token (EKS) / AAD token (AKS) will be exchanged for a kube::Client.
    #[allow(dead_code)]
    async fn get_or_init_client(&self) -> Result<Client, ConnectorError> {
        let read = self.client.read().await;
        if let Some(c) = &*read {
            return Ok(c.clone());
        }
        drop(read);

        let mut write = self.client.write().await;
        if let Some(c) = &*write {
            return Ok(c.clone());
        }

        let _token = self.generate_aad_token().await?;
        let config = Config::new(self.cluster_endpoint.parse().map_err(|e| {
            ConnectorError::ConnectionError(format!("Invalid endpoint URL: {}", e))
        })?);

        let client = Client::try_from(config)?;
        *write = Some(client.clone());
        Ok(client)
    }
}

#[async_trait]
impl ClusterConnector for AksConnector {
    async fn get_context_summary(&self) -> Result<ClusterContextSummary, ConnectorError> {
        Ok(ClusterContextSummary {
            id: format!("aks:{}:{}", self.resource_group, self.cluster_name),
            name: self.cluster_name.clone(),
            provider: "aks".to_string(),
            environment: self.environment.clone(),
            server_url: self.cluster_endpoint.clone(),
            current_namespace: "default".to_string(),
            is_active: true,
        })
    }

    async fn get_client(&self) -> Result<Client, ConnectorError> {
        let guard = self.client.read().await;
        guard
            .clone()
            .ok_or_else(|| ConnectorError::ConnectionError("Client not initialized".to_string()))
    }
}
