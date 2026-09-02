use super::redact::RedactionEngine;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub cluster_id: String,
    pub environment: String,
    pub action: String, // e.g. "scale_resource", "apply_manifest", "delete_pod"
    pub target_resource: String,
    pub origin: String, // "manual" or "ai_copilot"
    pub diff_summary: Option<String>,
    pub status: String, // "success", "failed", "rejected_by_user"
}

pub struct AuditLogger {
    entries: Arc<RwLock<Vec<AuditEntry>>>,
}

impl Default for AuditLogger {
    fn default() -> Self {
        Self::new()
    }
}

impl AuditLogger {
    pub fn new() -> Self {
        Self {
            entries: Arc::new(RwLock::new(Vec::new())),
        }
    }

    // Every parameter is a distinct field of the audit record. Bundling them into a
    // struct to satisfy the arity lint would only move the same list one line up.
    #[allow(clippy::too_many_arguments)]
    pub async fn log(
        &self,
        cluster_id: &str,
        environment: &str,
        action: &str,
        target_resource: &str,
        origin: &str,
        diff_summary: Option<&str>,
        status: &str,
    ) {
        let entry = AuditEntry {
            id: format!("audit-{}", Utc::now().timestamp_nanos_opt().unwrap_or(0)),
            timestamp: Utc::now(),
            cluster_id: cluster_id.to_string(),
            environment: environment.to_string(),
            action: action.to_string(),
            target_resource: target_resource.to_string(),
            origin: origin.to_string(),
            diff_summary: diff_summary.map(RedactionEngine::scrub),
            status: status.to_string(),
        };

        let mut write = self.entries.write().await;
        write.push(entry);
    }

    pub async fn get_entries(&self) -> Vec<AuditEntry> {
        let read = self.entries.read().await;
        read.clone()
    }

    pub async fn export_json(&self) -> Result<String, serde_json::Error> {
        let read = self.entries.read().await;
        serde_json::to_string_pretty(&*read)
    }
}
