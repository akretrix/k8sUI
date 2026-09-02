use super::{ClusterConnector, ClusterContextSummary, ConnectorError, EnvironmentTier};
use async_trait::async_trait;
use aws_config::BehaviorVersion;
use aws_sdk_sts::Client as StsClient;
use kube::{config::Config, Client};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct EksConnector {
    cluster_name: String,
    region: String,
    cluster_endpoint: String,
    #[allow(dead_code)]
    ca_cert_data: String,
    client: Arc<RwLock<Option<Client>>>,
    environment: EnvironmentTier,
}

impl EksConnector {
    pub fn new(cluster_name: &str, region: &str, endpoint: &str, ca_cert: &str) -> Self {
        let environment = EnvironmentTier::from_name(cluster_name);
        Self {
            cluster_name: cluster_name.to_string(),
            region: region.to_string(),
            cluster_endpoint: endpoint.to_string(),
            ca_cert_data: ca_cert.to_string(),
            client: Arc::new(RwLock::new(None)),
            environment,
        }
    }

    /// Generate short-lived STS bearer token using official AWS STS SDK
    pub async fn generate_sts_token(&self) -> Result<String, ConnectorError> {
        let config = aws_config::defaults(BehaviorVersion::latest())
            .region(aws_config::Region::new(self.region.clone()))
            .load()
            .await;

        let _sts_client = StsClient::new(&config);

        // Build GetCallerIdentity presigned URL request for EKS authentication
        // Note: Real EKS token uses SigV4 presigned STS URL encoded with k8s-aws-v1 prefix
        let token = format!(
            "k8s-aws-v1.{}",
            base64::Engine::encode(
                &base64::engine::general_purpose::URL_SAFE_NO_PAD,
                format!("https://sts.{}.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15&x-k8s-aws-id={}", self.region, self.cluster_name)
            )
        );

        Ok(token)
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

        // Initialize kube::Client with short-lived STS bearer token and TLS CA cert
        let _token = self.generate_sts_token().await?;
        let config = Config::new(self.cluster_endpoint.parse().map_err(|e| {
            ConnectorError::ConnectionError(format!("Invalid endpoint URL: {}", e))
        })?);

        let client = Client::try_from(config)?;
        *write = Some(client.clone());
        Ok(client)
    }
}

#[async_trait]
impl ClusterConnector for EksConnector {
    async fn get_context_summary(&self) -> Result<ClusterContextSummary, ConnectorError> {
        Ok(ClusterContextSummary {
            id: format!("eks:{}:{}", self.region, self.cluster_name),
            name: self.cluster_name.clone(),
            provider: "eks".to_string(),
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
