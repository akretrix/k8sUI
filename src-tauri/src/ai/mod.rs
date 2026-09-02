pub mod provider;
pub mod safety;
pub mod tools;

use provider::ModelProvider;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AiCopilotService {
    provider: Arc<RwLock<Option<Arc<dyn ModelProvider>>>>,
    is_enabled: Arc<RwLock<bool>>,
}

impl Default for AiCopilotService {
    fn default() -> Self {
        Self::new()
    }
}

impl AiCopilotService {
    pub fn new() -> Self {
        Self {
            provider: Arc::new(RwLock::new(None)),
            is_enabled: Arc::new(RwLock::new(false)), // Off by default
        }
    }

    pub async fn set_provider(&self, provider: Arc<dyn ModelProvider>) {
        let mut write = self.provider.write().await;
        *write = Some(provider);
    }

    pub async fn set_enabled(&self, enabled: bool) {
        let mut write = self.is_enabled.write().await;
        *write = enabled;
    }

    pub async fn is_enabled(&self) -> bool {
        let read = self.is_enabled.read().await;
        *read
    }
}
