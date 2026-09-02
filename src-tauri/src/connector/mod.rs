pub mod aks;
pub mod aws_sso;
pub mod eks;
pub mod local;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConnectorError {
    #[error("Kubernetes client error: {0}")]
    KubeError(#[from] kube::Error),

    #[error("Authentication error: {0}")]
    AuthError(String),

    #[error("Cluster connection failed: {0}")]
    ConnectionError(String),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Permission denied (RBAC): {0}")]
    PermissionDenied(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Dry-run validation error: {0}")]
    DryRunError(String),

    #[error("Terminal exec error: {0}")]
    TerminalError(String),

    #[error("Port forward error: {0}")]
    PortForwardError(String),

    #[error("Request timed out: {0}")]
    Timeout(String),

    #[error("Helm execution error: {0}")]
    HelmError(String),

    #[error("{0}")]
    Generic(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum EnvironmentTier {
    Production,
    Staging,
    Development,
    Local,
}

impl EnvironmentTier {
    pub fn from_name(name: &str) -> Self {
        let lower = name.to_lowercase();
        if lower.contains("prod") || lower.contains("prd") {
            EnvironmentTier::Production
        } else if lower.contains("stage") || lower.contains("staging") || lower.contains("qa") {
            EnvironmentTier::Staging
        } else if lower.contains("kind")
            || lower.contains("minikube")
            || lower.contains("local")
            || lower.contains("docker-desktop")
        {
            EnvironmentTier::Local
        } else {
            EnvironmentTier::Development
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterContextSummary {
    pub id: String,
    pub name: String,
    pub provider: String, // "local", "eks", "aks"
    pub environment: EnvironmentTier,
    pub server_url: String,
    pub current_namespace: String,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerStatusSummary {
    pub name: String,
    pub ready: bool,
    pub state: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodSummary {
    pub name: String,
    pub namespace: String,
    pub ready_containers: String, // e.g. "1/1"
    pub status: String,           // "Running", "CrashLoopBackOff", "Pending", "Completed"
    pub restarts: i32,
    pub age: String,
    pub cpu: Option<String>,
    pub memory: Option<String>,
    pub node: Option<String>,
    pub containers: Option<Vec<ContainerStatusSummary>>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretEntry {
    pub key: String,
    pub value: String,
    pub base64: String,
    pub is_binary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretDetails {
    pub name: String,
    pub namespace: String,
    pub secret_type: String,
    pub entries: Vec<SecretEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelmRevisionInfo {
    pub revision: i32,
    pub updated: String,
    pub status: String,
    pub chart: String,
    pub app_version: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelmChildResource {
    pub kind: String,
    pub name: String,
    pub namespace: Option<String>,
    pub api_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelmReleaseDetails {
    pub name: String,
    pub namespace: String,
    pub revision: i32,
    pub status: String,
    pub chart_name: String,
    pub chart_version: String,
    pub app_version: String,
    pub updated: String,
    pub user_values_yaml: String,
    pub computed_values_yaml: String,
    pub manifest: String,
    pub notes: String,
    pub history: Vec<HelmRevisionInfo>,
    pub child_resources: Vec<HelmChildResource>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DryRunResult {
    pub kind: String,
    pub name: String,
    pub namespace: Option<String>,
    pub original_yaml: String,
    pub proposed_yaml: String,
    pub diff: String,
    pub server_validation_passed: bool,
    pub validation_warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplyResult {
    pub kind: String,
    pub name: String,
    pub namespace: Option<String>,
    pub action: String, // "created", "configured", "unchanged"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScaleResult {
    pub kind: String,
    pub name: String,
    pub namespace: String,
    pub previous_replicas: i32,
    pub new_replicas: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivePortForward {
    pub session_id: String,
    pub namespace: String,
    pub pod_name: String,
    pub container_port: u16,
    pub local_port: u16,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceMetricRing {
    pub usage: f64,
    pub requests: f64,
    pub limits: f64,
    pub allocatable: f64,
    pub capacity: f64,
    pub unit: String,
    pub limits_exceed_capacity: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodsMetricRing {
    pub running: i32,
    pub scheduled: i32,
    pub pending: i32,
    pub failed: i32,
    pub capacity: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodesMetricSummary {
    pub ready: i32,
    pub total: i32,
    pub workers: i32,
    pub control_plane: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkloadHealthSummary {
    pub deployments_ready: i32,
    pub deployments_total: i32,
    pub statefulsets_ready: i32,
    pub statefulsets_total: i32,
    pub daemonsets_ready: i32,
    pub daemonsets_total: i32,
    pub cronjobs_active: i32,
    pub cronjobs_total: i32,
    pub jobs_active: i32,
    pub jobs_succeeded: i32,
    pub jobs_failed: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopologyBadge {
    pub name: String,
    pub count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeTopologySummary {
    pub zones: Vec<TopologyBadge>,
    pub capacity_types: Vec<TopologyBadge>,
    pub architectures: Vec<TopologyBadge>,
    pub instance_types: Vec<TopologyBadge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterWarningEvent {
    pub message: String,
    pub object_name: String,
    pub kind: String,
    pub namespace: String,
    pub count: i32,
    pub age: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterOverviewData {
    pub cpu: ResourceMetricRing,
    pub memory: ResourceMetricRing,
    pub pods: PodsMetricRing,
    pub nodes: NodesMetricSummary,
    pub workload_health: WorkloadHealthSummary,
    pub topology: NodeTopologySummary,
    pub warnings: Vec<ClusterWarningEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ClusterHealthStatus {
    Connected,
    AuthExpired,
    Unreachable,
    Disconnected,
    Checking,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterHealthInfo {
    pub status: ClusterHealthStatus,
    pub message: Option<String>,
    pub latency_ms: Option<u64>,
    pub k8s_version: Option<String>,
    pub detected_profile: Option<String>,
    pub is_sso: bool,
    pub last_checked: String,
}

#[async_trait]
pub trait ClusterConnector: Send + Sync {
    async fn get_context_summary(&self) -> Result<ClusterContextSummary, ConnectorError>;
    async fn get_client(&self) -> Result<kube::Client, ConnectorError>;
}
