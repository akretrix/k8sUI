use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "tool", content = "params")]
pub enum WhitelistedTool {
    #[serde(rename = "list_pods")]
    ListPods { namespace: Option<String> },
    #[serde(rename = "describe_resource")]
    DescribeResource {
        kind: String,
        name: String,
        namespace: Option<String>,
    },
    #[serde(rename = "get_logs")]
    GetLogs {
        namespace: String,
        pod_name: String,
        container: Option<String>,
        tail_lines: Option<i64>,
    },
    #[serde(rename = "scale_deployment")]
    ScaleDeployment {
        namespace: String,
        name: String,
        replicas: i32,
    },
    #[serde(rename = "apply_manifest")]
    ApplyManifest {
        manifest_yaml: String,
        namespace: Option<String>,
    },
}

impl WhitelistedTool {
    pub fn is_mutating(&self) -> bool {
        matches!(
            self,
            WhitelistedTool::ScaleDeployment { .. } | WhitelistedTool::ApplyManifest { .. }
        )
    }

    pub fn tool_name(&self) -> &'static str {
        match self {
            WhitelistedTool::ListPods { .. } => "list_pods",
            WhitelistedTool::DescribeResource { .. } => "describe_resource",
            WhitelistedTool::GetLogs { .. } => "get_logs",
            WhitelistedTool::ScaleDeployment { .. } => "scale_deployment",
            WhitelistedTool::ApplyManifest { .. } => "apply_manifest",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingAiProposal {
    pub proposal_id: String,
    pub tool_call: WhitelistedTool,
    pub dry_run_diff: String,
    pub explanation: String,
    pub target_cluster: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}
