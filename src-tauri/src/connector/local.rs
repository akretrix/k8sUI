use super::{ClusterConnector, ClusterContextSummary, ConnectorError, EnvironmentTier};
use async_trait::async_trait;
use kube::{config::KubeConfigOptions, Client, Config};

pub struct LocalConnector {
    client: Client,
    context_name: String,
    cluster_url: String,
    environment: EnvironmentTier,
}

impl LocalConnector {
    pub async fn from_context(context_name: &str) -> Result<Self, ConnectorError> {
        let options = KubeConfigOptions {
            context: Some(context_name.to_string()),
            ..Default::default()
        };

        let config = Config::from_kubeconfig(&options).await.map_err(|e| {
            ConnectorError::ConnectionError(format!(
                "Failed to load context {}: {}",
                context_name, e
            ))
        })?;

        let cluster_url = config.cluster_url.to_string();
        let client = Client::try_from(config)?;
        let environment = EnvironmentTier::from_name(context_name);

        Ok(Self {
            client,
            context_name: context_name.to_string(),
            cluster_url,
            environment,
        })
    }

    pub async fn from_default_client(
        client: Client,
        context_name: String,
        cluster_url: String,
    ) -> Self {
        let environment = EnvironmentTier::from_name(&context_name);
        Self {
            client,
            context_name,
            cluster_url,
            environment,
        }
    }
}

#[async_trait]
impl ClusterConnector for LocalConnector {
    async fn get_context_summary(&self) -> Result<ClusterContextSummary, ConnectorError> {
        Ok(ClusterContextSummary {
            id: format!("local:{}", self.context_name),
            name: self.context_name.clone(),
            provider: "local".to_string(),
            environment: self.environment.clone(),
            server_url: self.cluster_url.clone(),
            current_namespace: "default".to_string(),
            is_active: true,
        })
    }

    async fn get_client(&self) -> Result<Client, ConnectorError> {
        Ok(self.client.clone())
    }
}
