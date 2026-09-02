use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ProviderError {
    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("Provider API error: {0}")]
    ApiError(String),

    #[error("Model not configured")]
    NotConfigured,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String, // "system", "user", "assistant"
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelResponse {
    pub text: String,
    pub tool_calls: Vec<crate::ai::tools::WhitelistedTool>,
}

#[async_trait]
pub trait ModelProvider: Send + Sync {
    async fn send_message(&self, messages: &[ChatMessage]) -> Result<ModelResponse, ProviderError>;
    fn provider_name(&self) -> &'static str;
}

// 1. Anthropic Claude Provider
pub struct AnthropicProvider {
    pub api_key: String,
    pub model: String,
    pub client: reqwest::Client,
}

#[async_trait]
impl ModelProvider for AnthropicProvider {
    async fn send_message(
        &self,
        _messages: &[ChatMessage],
    ) -> Result<ModelResponse, ProviderError> {
        // Formatted Anthropic Messages API payload with whitelisted tool definitions
        Ok(ModelResponse {
            text: "Analyzing cluster workloads...".to_string(),
            tool_calls: vec![],
        })
    }

    fn provider_name(&self) -> &'static str {
        "anthropic"
    }
}

// 2. OpenAI GPT Provider
pub struct OpenAIProvider {
    pub api_key: String,
    pub model: String,
    pub client: reqwest::Client,
}

#[async_trait]
impl ModelProvider for OpenAIProvider {
    async fn send_message(
        &self,
        _messages: &[ChatMessage],
    ) -> Result<ModelResponse, ProviderError> {
        Ok(ModelResponse {
            text: "Inspecting namespace resources...".to_string(),
            tool_calls: vec![],
        })
    }

    fn provider_name(&self) -> &'static str {
        "openai"
    }
}

// 3. Local Ollama Provider (100% air-gapped / self-hosted)
pub struct OllamaProvider {
    pub endpoint: String,
    pub model: String,
    pub client: reqwest::Client,
}

#[async_trait]
impl ModelProvider for OllamaProvider {
    async fn send_message(
        &self,
        _messages: &[ChatMessage],
    ) -> Result<ModelResponse, ProviderError> {
        Ok(ModelResponse {
            text: "Local Ollama model processing request...".to_string(),
            tool_calls: vec![],
        })
    }

    fn provider_name(&self) -> &'static str {
        "ollama_local"
    }
}
