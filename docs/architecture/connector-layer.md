# Connector Layer Architecture

The **Connector Layer** abstracts Kubernetes cluster operations and cloud authentication mechanisms behind an async, object-safe Rust trait: `ClusterConnector`.

---

## 1. The `ClusterConnector` Trait

```rust
#[async_trait::async_trait]
pub trait ClusterConnector: Send + Sync {
    /// Retrieve cluster metadata and connection status
    async fn status(&self) -> Result<ClusterStatus, ConnectorError>;

    /// List pods in a namespace (or all namespaces)
    async fn list_pods(&self, namespace: Option<&str>) -> Result<Vec<PodSummary>, ConnectorError>;

    /// Stream pod updates via Kubernetes Watch API
    async fn watch_pods(
        &self,
        namespace: Option<&str>,
        event_sender: tokio::sync::mpsc::Sender<PodWatchEvent>,
    ) -> Result<(), ConnectorError>;

    /// Fetch a single resource manifest in YAML/JSON
    async fn get_resource(&self, gvk: &GroupVersionKind, name: &str, namespace: Option<&str>) -> Result<String, ConnectorError>;

    /// Generate dry-run diff for a manifest apply or resource modification
    async fn dry_run_apply(&self, manifest: &str, namespace: Option<&str>) -> Result<DryRunResult, ConnectorError>;

    /// Apply or update a resource manifest (must pass server-side dry-run checks)
    async fn apply_resource(&self, manifest: &str, namespace: Option<&str>) -> Result<ApplyResult, ConnectorError>;

    /// Scale a deployment or statefulset
    async fn scale_resource(&self, kind: &str, name: &str, namespace: &str, replicas: i32) -> Result<ScaleResult, ConnectorError>;

    /// Open an interactive container terminal session (Kubernetes exec subresource)
    async fn exec_terminal(
        &self,
        namespace: &str,
        pod_name: &str,
        container: Option<&str>,
        stdin_receiver: tokio::sync::mpsc::Receiver<Vec<u8>>,
        stdout_sender: tokio::sync::mpsc::Sender<Vec<u8>>,
    ) -> Result<(), ConnectorError>;

    /// Initialize a port-forward tunnel to a pod/service
    async fn port_forward(
        &self,
        namespace: &str,
        pod_name: &str,
        target_port: u16,
        local_port: u16,
    ) -> Result<PortForwardHandle, ConnectorError>;
}
```

---

## 2. Cloud Auth Implementations

### Local Connector (`LocalConnector`)
- Connects using the standard `~/.kube/config` context.
- Parses kubeconfig using `kube::config::Kubeconfig` and initializes standard `kube::Client`.

### Amazon EKS Connector (`EksConnector`)
- Uses the official AWS SDK (`aws-sdk-sts`, `aws-config`, `aws-sigv4`).
- Generates a short-lived `k8s-aws-v1` presigned URL authorization token via `GetCallerIdentity`.
- Tokens expire in 15 minutes and are refreshed automatically in memory.
- **Zero static credentials** are stored on disk.

### Azure AKS Connector (`AksConnector`)
- Uses `azure_identity` to obtain an Azure AD access token for the target AKS cluster resource ID (`6dae42f6-4360-4794-a3e0-dd704400e786` or cluster-specific SPN).
- Follows modern Entra ID token exchange (kubelogin style).
- No service principal client secrets are persisted.
