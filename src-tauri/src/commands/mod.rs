use crate::connector::{
    ActivePortForward, ApplyResult, ClusterContextSummary, ClusterHealthInfo, ClusterHealthStatus,
    DryRunResult, PodSummary, ScaleResult,
};
use crate::core::audit::AuditEntry;
use crate::core::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(err: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(err),
        }
    }
}

#[tauri::command]
pub async fn check_cluster_health(
    state: State<'_, AppState>,
) -> Result<ApiResponse<ClusterHealthInfo>, String> {
    let active = match state.session.get_active_summary().await {
        Some(a) => a,
        None => {
            return Ok(ApiResponse::ok(ClusterHealthInfo {
                status: ClusterHealthStatus::Disconnected,
                message: Some("No active cluster selected".to_string()),
                latency_ms: None,
                k8s_version: None,
                detected_profile: None,
                is_sso: false,
                last_checked: chrono::Utc::now().to_rfc3339(),
            }));
        }
    };

    let is_sso = active.provider == "eks"
        || active.name.contains("pdn-")
        || active.name.contains("qa-")
        || active.server_url.contains("eks.amazonaws.com");

    let detected_profile = if let Ok(kube_config) = kube::config::Kubeconfig::read() {
        kube_config
            .contexts
            .iter()
            .find(|c| c.name == active.name)
            .and_then(|ctx| {
                let user_ref = ctx.context.as_ref().map(|c| &c.user);
                if let Some(user_name) = user_ref {
                    if let Some(u) = kube_config.auth_infos.iter().find(|u| &u.name == user_name) {
                        if let Some(exec) = u.auth_info.as_ref().and_then(|ai| ai.exec.as_ref()) {
                            if let Some(env_vars) = &exec.env {
                                for map in env_vars {
                                    if map.get("name").map(|s| s.as_str()) == Some("AWS_PROFILE") {
                                        if let Some(val) = map.get("value") {
                                            return Some(val.clone());
                                        }
                                    }
                                }
                            }
                            if let Some(args) = &exec.args {
                                for (i, arg) in args.iter().enumerate() {
                                    if arg == "--profile" && i + 1 < args.len() {
                                        return Some(args[i + 1].clone());
                                    }
                                }
                            }
                        }
                    }
                }
                None
            })
    } else {
        None
    };

    let mgr = match state.session.get_resource_manager().await {
        Ok(m) => m,
        Err(e) => {
            let err_str = e.to_string();
            let lower = err_str.to_lowercase();
            let status = if lower.contains("401")
                || lower.contains("unauthorized")
                || lower.contains("token")
                || lower.contains("expired")
                || lower.contains("unrecognizedclientexception")
            {
                ClusterHealthStatus::AuthExpired
            } else {
                ClusterHealthStatus::Unreachable
            };
            return Ok(ApiResponse::ok(ClusterHealthInfo {
                status,
                message: Some(err_str),
                latency_ms: None,
                k8s_version: None,
                detected_profile,
                is_sso,
                last_checked: chrono::Utc::now().to_rfc3339(),
            }));
        }
    };

    match mgr.check_cluster_health().await {
        Ok((latency_ms, k8s_version)) => Ok(ApiResponse::ok(ClusterHealthInfo {
            status: ClusterHealthStatus::Connected,
            message: None,
            latency_ms: Some(latency_ms),
            k8s_version,
            detected_profile,
            is_sso,
            last_checked: chrono::Utc::now().to_rfc3339(),
        })),
        Err(e) => {
            let err_str = e.to_string();
            let lower = err_str.to_lowercase();
            let status = if lower.contains("401")
                || lower.contains("unauthorized")
                || lower.contains("token")
                || lower.contains("expired")
                || lower.contains("unrecognizedclientexception")
                || lower.contains("auth exec command")
            {
                ClusterHealthStatus::AuthExpired
            } else {
                ClusterHealthStatus::Unreachable
            };
            Ok(ApiResponse::ok(ClusterHealthInfo {
                status,
                message: Some(err_str),
                latency_ms: None,
                k8s_version: None,
                detected_profile,
                is_sso,
                last_checked: chrono::Utc::now().to_rfc3339(),
            }))
        }
    }
}

#[tauri::command]
pub async fn reconnect_cluster(
    cluster_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<ApiResponse<ClusterHealthInfo>, String> {
    let target_id = if let Some(id) = cluster_id {
        id
    } else if let Some(active) = state.session.get_active_summary().await {
        active.id
    } else {
        return Ok(ApiResponse::err(
            "No active cluster to reconnect".to_string(),
        ));
    };

    // Invalidate cached resource manager
    state.session.invalidate_resource_manager().await;

    // Connect cluster
    match connect_cluster(target_id, state.clone()).await {
        Ok(res) => {
            if !res.success {
                return Ok(ApiResponse::ok(ClusterHealthInfo {
                    status: ClusterHealthStatus::Unreachable,
                    message: res.error,
                    latency_ms: None,
                    k8s_version: None,
                    detected_profile: None,
                    is_sso: false,
                    last_checked: chrono::Utc::now().to_rfc3339(),
                }));
            }
            // Check health on the newly connected cluster
            check_cluster_health(state).await
        }
        Err(e) => Ok(ApiResponse::ok(ClusterHealthInfo {
            status: ClusterHealthStatus::Unreachable,
            message: Some(e),
            latency_ms: None,
            k8s_version: None,
            detected_profile: None,
            is_sso: false,
            last_checked: chrono::Utc::now().to_rfc3339(),
        })),
    }
}

#[tauri::command]
pub async fn get_available_clusters(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<ClusterContextSummary>>, String> {
    let clusters = state.session.get_available_clusters().await;

    // Always dynamically load real clusters from kubeconfig
    if let Ok(kube_config) = kube::config::Kubeconfig::read() {
        let mut real_clusters = Vec::new();
        let current_ctx_name = kube_config.current_context.clone();

        for ctx in kube_config.contexts.iter() {
            let env = if ctx.name.contains("prod") || ctx.name.contains("pdn") {
                crate::connector::EnvironmentTier::Production
            } else if ctx.name.contains("staging") || ctx.name.contains("qa") {
                crate::connector::EnvironmentTier::Staging
            } else if ctx.name.contains("kind")
                || ctx.name.contains("minikube")
                || ctx.name.contains("k3d")
                || ctx.name.contains("docker-desktop")
            {
                crate::connector::EnvironmentTier::Local
            } else {
                crate::connector::EnvironmentTier::Development
            };

            let cluster_ref = ctx
                .context
                .as_ref()
                .map(|c| c.cluster.clone())
                .unwrap_or_default();
            let server_url = kube_config
                .clusters
                .iter()
                .find(|c| c.name == cluster_ref)
                .and_then(|c| c.cluster.as_ref())
                .and_then(|c| c.server.clone())
                .unwrap_or(cluster_ref);

            let provider = if server_url.contains(".eks.amazonaws.com") {
                "eks"
            } else if server_url.contains(".azmk8s.io") {
                "aks"
            } else {
                "local"
            };

            let is_current = current_ctx_name
                .as_ref()
                .map(|c| c == &ctx.name)
                .unwrap_or(false);

            real_clusters.push(ClusterContextSummary {
                id: format!("{}:{}", provider, ctx.name),
                name: ctx.name.clone(),
                provider: provider.to_string(),
                environment: env,
                server_url,
                current_namespace: ctx
                    .context
                    .as_ref()
                    .and_then(|c| c.namespace.clone())
                    .unwrap_or_else(|| "default".to_string()),
                is_active: is_current,
            });
        }

        // If there is an active connector in session, mark that instead
        if let Some(active) = state.session.get_active_summary().await {
            for c in real_clusters.iter_mut() {
                c.is_active = c.name == active.name || c.id == active.id;
            }
        }

        state
            .session
            .set_available_clusters(real_clusters.clone())
            .await;
        return Ok(ApiResponse::ok(real_clusters));
    }

    // Fallback if kubeconfig read fails (e.g., no config)
    Ok(ApiResponse::ok(clusters))
}

#[tauri::command]
pub async fn connect_cluster(
    cluster_id: String,
    state: State<'_, AppState>,
) -> Result<ApiResponse<ClusterContextSummary>, String> {
    let clusters = state.session.get_available_clusters().await;
    let target = clusters
        .into_iter()
        .find(|c| c.id == cluster_id || c.name == cluster_id || cluster_id.ends_with(&c.name));

    let target = match target {
        Some(t) => Some(t),
        None => {
            if let Ok(kube_config) = kube::config::Kubeconfig::read() {
                kube_config
                    .contexts
                    .into_iter()
                    .find(|ctx| ctx.name == cluster_id || cluster_id.ends_with(&ctx.name))
                    .map(|ctx| {
                        let env = if ctx.name.contains("prod") {
                            crate::connector::EnvironmentTier::Production
                        } else if ctx.name.contains("staging") || ctx.name.contains("qa") {
                            crate::connector::EnvironmentTier::Staging
                        } else {
                            crate::connector::EnvironmentTier::Development
                        };
                        let cluster_ref = ctx
                            .context
                            .as_ref()
                            .map(|c| c.cluster.clone())
                            .unwrap_or_default();
                        let server_url = kube_config
                            .clusters
                            .iter()
                            .find(|c| c.name == cluster_ref)
                            .and_then(|c| c.cluster.as_ref())
                            .and_then(|c| c.server.clone())
                            .unwrap_or(cluster_ref);
                        let provider = if server_url.contains(".eks.amazonaws.com") {
                            "eks"
                        } else if server_url.contains(".azmk8s.io") {
                            "aks"
                        } else {
                            "local"
                        };
                        ClusterContextSummary {
                            id: format!("{}:{}", provider, ctx.name),
                            name: ctx.name.clone(),
                            provider: provider.to_string(),
                            environment: env,
                            server_url,
                            current_namespace: ctx
                                .context
                                .as_ref()
                                .and_then(|c| c.namespace.clone())
                                .unwrap_or_else(|| "default".to_string()),
                            is_active: false,
                        }
                    })
            } else {
                None
            }
        }
    };

    if let Some(mut cluster) = target {
        cluster.is_active = true;

        let kube_options = kube::config::KubeConfigOptions {
            context: Some(cluster.name.clone()),
            cluster: None,
            user: None,
        };

        let client_config = match kube::Config::from_kubeconfig(&kube_options).await {
            Ok(c) => c,
            Err(e) => {
                return Ok(ApiResponse::err(format!(
                    "Could not load kubeconfig context '{}': {}",
                    cluster.name, e
                )))
            }
        };

        let client = match kube::Client::try_from(client_config) {
            Ok(c) => c,
            Err(e) => {
                return Ok(ApiResponse::err(format!(
                    "Failed to connect to cluster '{}': {}",
                    cluster.name, e
                )))
            }
        };

        let connector = Arc::new(
            crate::connector::local::LocalConnector::from_default_client(
                client,
                cluster.name.clone(),
                cluster.server_url.clone(),
            )
            .await,
        );

        state
            .session
            .set_active_connector(connector, cluster.clone())
            .await;

        state
            .audit
            .log(
                &cluster.id,
                &format!("{:?}", cluster.environment),
                "connect_cluster",
                &cluster.name,
                "manual",
                None,
                "connected_read_only",
            )
            .await;

        Ok(ApiResponse::ok(cluster))
    } else {
        Ok(ApiResponse::err(format!(
            "Cluster '{}' not found in kubeconfig",
            cluster_id
        )))
    }
}

#[tauri::command]
pub async fn get_active_cluster(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Option<ClusterContextSummary>>, String> {
    Ok(ApiResponse::ok(state.session.get_active_summary().await))
}

#[tauri::command]
pub async fn get_read_only_status(state: State<'_, AppState>) -> Result<ApiResponse<bool>, String> {
    Ok(ApiResponse::ok(state.session.is_read_only().await))
}

#[tauri::command]
pub async fn set_write_mode(
    unlocked: bool,
    state: State<'_, AppState>,
) -> Result<ApiResponse<bool>, String> {
    state.session.set_write_mode_unlocked(unlocked).await;
    if let Some(summary) = state.session.get_active_summary().await {
        state
            .audit
            .log(
                &summary.id,
                &format!("{:?}", summary.environment),
                "set_write_mode",
                if unlocked {
                    "write_mode_unlocked"
                } else {
                    "read_only_locked"
                },
                "manual",
                None,
                "success",
            )
            .await;
    }
    Ok(ApiResponse::ok(unlocked))
}

#[tauri::command]
pub async fn list_namespaces(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<String>>, String> {
    let mgr = match state.session.get_resource_manager().await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e.to_string())),
    };
    match mgr.list_namespaces().await {
        Ok(ns) => Ok(ApiResponse::ok(ns)),
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn list_pods(
    namespace: Option<String>,
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<PodSummary>>, String> {
    let mgr = match state.session.get_resource_manager().await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e.to_string())),
    };
    match mgr.list_pods(namespace.as_deref()).await {
        Ok(pods) => Ok(ApiResponse::ok(pods)),
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn list_resources(
    kind: String,
    namespace: Option<String>,
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<serde_json::Value>>, String> {
    let mgr = match state.session.get_resource_manager().await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e.to_string())),
    };
    match mgr.list_resources(&kind, namespace.as_deref()).await {
        Ok(res) => Ok(ApiResponse::ok(res)),
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn describe_resource(
    kind: String,
    name: String,
    namespace: Option<String>,
    state: State<'_, AppState>,
) -> Result<ApiResponse<String>, String> {
    let mgr = match state.session.get_resource_manager().await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e.to_string())),
    };
    match mgr
        .describe_resource(&kind, &name, namespace.as_deref())
        .await
    {
        Ok(res) => Ok(ApiResponse::ok(res)),
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn get_resource_yaml(
    kind: String,
    name: String,
    namespace: Option<String>,
    state: State<'_, AppState>,
) -> Result<ApiResponse<String>, String> {
    let mgr = match state.session.get_resource_manager().await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e.to_string())),
    };
    match mgr
        .get_resource_yaml(&kind, &name, namespace.as_deref())
        .await
    {
        Ok(res) => Ok(ApiResponse::ok(res)),
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn dry_run_apply(
    manifest_yaml: String,
    namespace: Option<String>,
    state: State<'_, AppState>,
) -> Result<ApiResponse<DryRunResult>, String> {
    let mgr = match state.session.get_resource_manager().await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e.to_string())),
    };
    match mgr
        .dry_run_apply(&manifest_yaml, namespace.as_deref())
        .await
    {
        Ok(res) => Ok(ApiResponse::ok(res)),
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn apply_manifest(
    manifest_yaml: String,
    namespace: Option<String>,
    state: State<'_, AppState>,
) -> Result<ApiResponse<ApplyResult>, String> {
    if state.session.is_read_only().await {
        return Ok(ApiResponse::err(
            "Cannot apply manifest in Read-Only Mode. Unlock write access.".to_string(),
        ));
    }
    let mgr = match state.session.get_resource_manager().await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e.to_string())),
    };
    match mgr
        .apply_manifest(&manifest_yaml, namespace.as_deref())
        .await
    {
        Ok(res) => Ok(ApiResponse::ok(res)),
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn scale_resource(
    kind: String,
    name: String,
    namespace: String,
    replicas: i32,
    state: State<'_, AppState>,
) -> Result<ApiResponse<ScaleResult>, String> {
    if state.session.is_read_only().await {
        return Ok(ApiResponse::err(
            "Cannot scale in Read-Only Mode. Unlock write access.".to_string(),
        ));
    }
    let mgr = match state.session.get_resource_manager().await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e.to_string())),
    };
    match mgr.scale_resource(&kind, &name, &namespace, replicas).await {
        Ok(res) => Ok(ApiResponse::ok(res)),
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn restart_resource(
    kind: String,
    name: String,
    namespace: String,
    state: State<'_, AppState>,
) -> Result<ApiResponse<bool>, String> {
    if state.session.is_read_only().await {
        return Ok(ApiResponse::err(
            "Cannot restart in Read-Only Mode. Unlock write access.".to_string(),
        ));
    }
    let mgr = match state.session.get_resource_manager().await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e.to_string())),
    };
    match mgr.restart_resource(&kind, &name, &namespace).await {
        Ok(res) => {
            let (cluster_id, environment) = state
                .session
                .get_active_summary()
                .await
                .map(|s| (s.id, format!("{:?}", s.environment)))
                .unwrap_or_else(|| ("unknown".to_string(), "Unknown".to_string()));
            state
                .audit
                .log(
                    &cluster_id,
                    &environment,
                    "rollout_restart",
                    &format!("{}/{}", kind, name),
                    "manual",
                    Some(&format!("Rollout restart {} {}", kind, name)),
                    "success",
                )
                .await;
            Ok(ApiResponse::ok(res))
        }
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn delete_resource(
    kind: String,
    name: String,
    namespace: Option<String>,
    state: State<'_, AppState>,
) -> Result<ApiResponse<bool>, String> {
    if state.session.is_read_only().await {
        return Ok(ApiResponse::err(
            "Cannot delete in Read-Only Mode. Unlock write access.".to_string(),
        ));
    }
    let mgr = match state.session.get_resource_manager().await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e.to_string())),
    };
    match mgr
        .delete_resource(&kind, &name, namespace.as_deref())
        .await
    {
        Ok(res) => {
            let (cluster_id, environment) = state
                .session
                .get_active_summary()
                .await
                .map(|s| (s.id, format!("{:?}", s.environment)))
                .unwrap_or_else(|| ("unknown".to_string(), "Unknown".to_string()));
            state
                .audit
                .log(
                    &cluster_id,
                    &environment,
                    "delete_resource",
                    &format!("{}/{}", kind, name),
                    "manual",
                    Some(&format!("Deleted {} {}", kind, name)),
                    "success",
                )
                .await;
            Ok(ApiResponse::ok(res))
        }
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn get_cluster_overview(
    state: State<'_, AppState>,
) -> Result<ApiResponse<crate::connector::ClusterOverviewData>, String> {
    let mgr = match state.session.get_resource_manager().await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e.to_string())),
    };
    match mgr.get_cluster_overview().await {
        Ok(overview) => Ok(ApiResponse::ok(overview)),
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn get_audit_logs(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<AuditEntry>>, String> {
    Ok(ApiResponse::ok(state.audit.get_entries().await))
}

#[tauri::command]
pub async fn list_aws_sso_orgs(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<crate::connector::aws_sso::AwsSsoOrgConfig>>, String> {
    Ok(ApiResponse::ok(state.aws_sso.list_orgs().await))
}

#[tauri::command]
pub async fn register_aws_sso_org(
    alias: String,
    start_url: String,
    sso_region: String,
    state: State<'_, AppState>,
) -> Result<ApiResponse<crate::connector::aws_sso::AwsSsoOrgConfig>, String> {
    let org = state
        .aws_sso
        .register_org(alias, start_url, sso_region)
        .await;

    // Automatically trigger cluster discovery for the newly registered org
    let discovered = state.aws_sso.discover_clusters_for_org(&org.id).await;
    let mut current_clusters = state.session.get_available_clusters().await;
    for cluster in discovered {
        if !current_clusters.iter().any(|c| c.id == cluster.id) {
            current_clusters.push(cluster);
        }
    }
    state.session.set_available_clusters(current_clusters).await;

    state
        .audit
        .log(
            &org.id,
            "AWS SSO",
            "register_aws_sso_org",
            &org.start_url,
            "manual",
            None,
            "registered_and_discovered",
        )
        .await;

    Ok(ApiResponse::ok(org))
}

#[tauri::command]
pub async fn discover_aws_sso_clusters(
    org_id: String,
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<ClusterContextSummary>>, String> {
    let discovered = state.aws_sso.discover_clusters_for_org(&org_id).await;
    let mut current_clusters = state.session.get_available_clusters().await;
    for cluster in &discovered {
        if !current_clusters.iter().any(|c| c.id == cluster.id) {
            current_clusters.push(cluster.clone());
        }
    }
    state.session.set_available_clusters(current_clusters).await;

    Ok(ApiResponse::ok(discovered))
}

// --- Subsystem Integrations (Terminal, Port Forward, AI) ---

#[tauri::command]
pub async fn start_terminal(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    namespace: String,
    pod_name: String,
    container: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<ApiResponse<String>, String> {
    use tauri::Emitter;
    let connector = match state.session.get_active_connector().await {
        Ok(c) => c,
        Err(e) => return Ok(ApiResponse::err(e.to_string())),
    };

    let client = match connector.get_client().await {
        Ok(c) => c,
        Err(e) => return Ok(ApiResponse::err(e.to_string())),
    };

    let mgr = match manager_for(&state).await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e)),
    };
    let actual_pod_name = mgr.resolve_pod_name(&namespace, &pod_name).await;

    let (output_tx, mut output_rx) = tokio::sync::mpsc::channel::<Vec<u8>>(128);

    match state
        .terminal
        .spawn_exec(
            client,
            &namespace,
            &actual_pod_name,
            container.as_deref(),
            vec![],
            cols,
            rows,
            output_tx,
        )
        .await
    {
        Ok(session_id) => {
            let session_id_clone = session_id.clone();
            let app_handle = app.clone();
            tokio::spawn(async move {
                while let Some(bytes) = output_rx.recv().await {
                    let text = String::from_utf8_lossy(&bytes).to_string();
                    let payload = serde_json::json!({
                        "sessionId": session_id_clone,
                        "data": text
                    });
                    let _ = app_handle.emit("terminal-data", payload);
                }
            });
            Ok(ApiResponse::ok(session_id))
        }
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn close_terminal(
    state: tauri::State<'_, AppState>,
    session_id: String,
) -> Result<ApiResponse<()>, String> {
    state.terminal.close_session(&session_id).await;
    Ok(ApiResponse::ok(()))
}

#[tauri::command]
pub async fn terminal_input(
    state: tauri::State<'_, AppState>,
    session_id: String,
    data: String,
) -> Result<ApiResponse<()>, String> {
    match state
        .terminal
        .write_input(&session_id, data.into_bytes())
        .await
    {
        Ok(_) => Ok(ApiResponse::ok(())),
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn start_port_forward(
    state: tauri::State<'_, AppState>,
    namespace: String,
    pod_name: String,
    container_port: u16,
    local_port: u16,
) -> Result<ApiResponse<ActivePortForward>, String> {
    let connector = match state.session.get_active_connector().await {
        Ok(c) => c,
        Err(e) => return Ok(ApiResponse::err(e.to_string())),
    };
    let client = match connector.get_client().await {
        Ok(c) => c,
        Err(e) => return Ok(ApiResponse::err(e.to_string())),
    };

    // Same resolve-by-prefix as exec: a row can show a workload's base name
    // rather than the exact pod name the API expects.
    let mgr = match manager_for(&state).await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e)),
    };
    let actual_pod_name = mgr.resolve_pod_name(&namespace, &pod_name).await;

    match state
        .port_forward
        .start_port_forward(
            client,
            &namespace,
            &actual_pod_name,
            container_port,
            local_port,
        )
        .await
    {
        Ok(forward) => {
            if let Some(summary) = state.session.get_active_summary().await {
                state
                    .audit
                    .log(
                        &summary.id,
                        &format!("{:?}", summary.environment),
                        "start_port_forward",
                        &format!(
                            "{}/{}:{} -> 127.0.0.1:{}",
                            namespace, actual_pod_name, container_port, local_port
                        ),
                        "manual",
                        None,
                        "active",
                    )
                    .await;
            }
            Ok(ApiResponse::ok(forward))
        }
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn stop_port_forward(
    state: tauri::State<'_, AppState>,
    session_id: String,
) -> Result<ApiResponse<()>, String> {
    let _ = state.port_forward.stop_port_forward(&session_id).await;
    Ok(ApiResponse::ok(()))
}

#[tauri::command]
pub async fn list_port_forwards(
    state: tauri::State<'_, AppState>,
) -> Result<ApiResponse<Vec<ActivePortForward>>, String> {
    Ok(ApiResponse::ok(state.port_forward.list_active().await))
}

#[tauri::command]
pub async fn ask_ai_copilot(
    _state: tauri::State<'_, AppState>,
    query: String,
) -> Result<ApiResponse<String>, String> {
    Ok(ApiResponse::ok(format!("AI stub response for: {}", query)))
}

/// Resolve a resource manager for the active cluster, or a caller-facing reason why not.
async fn manager_for(
    state: &State<'_, AppState>,
) -> Result<std::sync::Arc<crate::core::resource_manager::GenericResourceManager>, String> {
    state
        .session
        .get_resource_manager()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_logs(
    namespace: String,
    pod_name: String,
    container: Option<String>,
    tail_lines: Option<i64>,
    previous: Option<bool>,
    timestamps: Option<bool>,
    state: State<'_, AppState>,
) -> Result<ApiResponse<String>, String> {
    let mgr = match manager_for(&state).await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e)),
    };
    match mgr
        .get_logs(
            &namespace,
            &pod_name,
            container.as_deref(),
            tail_lines,
            previous.unwrap_or(false),
            timestamps.unwrap_or(false),
        )
        .await
    {
        // Secrets and tokens leak through application logs constantly; the redaction
        // engine exists for exactly this path, so run it before the renderer sees it.
        Ok(logs) => Ok(ApiResponse::ok(
            crate::core::redact::RedactionEngine::scrub(&logs),
        )),
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn list_containers(
    namespace: String,
    pod_name: String,
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<String>>, String> {
    let mgr = match manager_for(&state).await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e)),
    };
    match mgr.list_containers(&namespace, &pod_name).await {
        Ok(names) => Ok(ApiResponse::ok(names)),
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn list_custom_resource_types(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<serde_json::Value>>, String> {
    let mgr = match manager_for(&state).await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e)),
    };
    match mgr.list_custom_resource_types().await {
        Ok(types) => Ok(ApiResponse::ok(types)),
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn get_secret_data(
    name: String,
    namespace: Option<String>,
    state: State<'_, AppState>,
) -> Result<ApiResponse<crate::connector::SecretDetails>, String> {
    let mgr = match manager_for(&state).await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e)),
    };

    match mgr.get_secret_data(&name, namespace.as_deref()).await {
        Ok(res) => {
            let cluster_id = state
                .session
                .get_active_summary()
                .await
                .map(|s| s.id)
                .unwrap_or_else(|| "unknown".to_string());
            state
                .audit
                .log(
                    &cluster_id,
                    "cluster",
                    "get_secret_data",
                    &format!("{}/{}", namespace.as_deref().unwrap_or("default"), name),
                    "desktop-ui",
                    None,
                    "success",
                )
                .await;
            Ok(ApiResponse::ok(res))
        }
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn update_secret_data(
    name: String,
    namespace: Option<String>,
    entries: std::collections::HashMap<String, String>,
    is_plaintext: bool,
    state: State<'_, AppState>,
) -> Result<ApiResponse<crate::connector::SecretDetails>, String> {
    if state.session.is_read_only().await {
        return Ok(ApiResponse::err(
            "Cannot modify secrets in Read-Only mode. Please unlock write mode first.".to_string(),
        ));
    }

    let mgr = match manager_for(&state).await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e)),
    };

    match mgr
        .update_secret_data(&name, namespace.as_deref(), entries, is_plaintext)
        .await
    {
        Ok(res) => {
            let cluster_id = state
                .session
                .get_active_summary()
                .await
                .map(|s| s.id)
                .unwrap_or_else(|| "unknown".to_string());
            state
                .audit
                .log(
                    &cluster_id,
                    "cluster",
                    "update_secret_data",
                    &format!("{}/{}", namespace.as_deref().unwrap_or("default"), name),
                    "desktop-ui",
                    Some("Updated secret key-values"),
                    "success",
                )
                .await;
            Ok(ApiResponse::ok(res))
        }
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

fn get_aws_cmd() -> std::process::Command {
    let aws_path = if std::path::Path::new("/opt/homebrew/bin/aws").exists() {
        "/opt/homebrew/bin/aws"
    } else if std::path::Path::new("/usr/local/bin/aws").exists() {
        "/usr/local/bin/aws"
    } else {
        "aws"
    };
    let mut cmd = std::process::Command::new(aws_path);
    let path_env = std::env::var("PATH").unwrap_or_default();
    let extended_path = format!("/opt/homebrew/bin:/usr/local/bin:{}", path_env);
    cmd.env("PATH", extended_path);
    cmd
}

#[tauri::command]
pub async fn list_aws_sso_sessions(
) -> Result<ApiResponse<Vec<crate::connector::aws_sso::SsoSessionEntry>>, String> {
    let sessions = crate::connector::aws_sso::parse_aws_sso_config();
    Ok(ApiResponse::ok(sessions))
}

#[tauri::command]
pub async fn aws_sso_login(
    profile: Option<String>,
    session_name: Option<String>,
    #[allow(non_snake_case)] sessionName: Option<String>,
    state: State<'_, AppState>,
) -> Result<ApiResponse<String>, String> {
    let all_sessions = crate::connector::aws_sso::parse_aws_sso_config();
    let requested_session = session_name.or(sessionName);

    tracing::info!(
        "aws_sso_login requested: session={:?}, profile={:?}",
        requested_session,
        profile
    );

    let target_session = if let Some(ref sname) = requested_session {
        all_sessions
            .iter()
            .find(|s| s.session_name.eq_ignore_ascii_case(sname.trim()))
            .cloned()
    } else if let Some(ref prof) = profile {
        all_sessions
            .iter()
            .find(|s| {
                s.session_name.eq_ignore_ascii_case(prof.trim())
                    || s.matching_profiles
                        .iter()
                        .any(|p| p.eq_ignore_ascii_case(prof.trim()))
            })
            .cloned()
    } else {
        all_sessions.first().cloned()
    };

    let session = match target_session {
        Some(s) => s,
        None => {
            if all_sessions.is_empty() {
                return Ok(ApiResponse::err(
                    "No AWS SSO sessions found in ~/.aws/config. Please run 'aws configure sso' or add an [sso-session] section.".to_string(),
                ));
            } else {
                all_sessions[0].clone()
            }
        }
    };

    tracing::info!(
        "Initiating native AWS SSO OIDC login for session '{}' ({})",
        session.session_name,
        session.start_url
    );

    match crate::connector::aws_sso::login_aws_sso_native(
        &session.start_url,
        &session.sso_region,
        &session.session_name,
    )
    .await
    {
        Ok(msg) => {
            let cluster_id = state
                .session
                .get_active_summary()
                .await
                .map(|s| s.id)
                .unwrap_or_else(|| "aws-sso".to_string());
            state
                .audit
                .log(
                    &cluster_id,
                    "aws",
                    "aws_sso_login",
                    &format!("sso-session/{}", session.session_name),
                    "desktop-ui",
                    None,
                    "success",
                )
                .await;
            Ok(ApiResponse::ok(msg))
        }
        Err(e) => Ok(ApiResponse::err(e)),
    }
}

#[tauri::command]
pub async fn get_sso_login_command(profile: Option<String>) -> Result<ApiResponse<String>, String> {
    let prof = profile.unwrap_or_else(|| "default".to_string());
    let prof_clone = prof.clone();

    tokio::task::spawn_blocking(move || {
        let mut session_cmd = get_aws_cmd();
        session_cmd.args(["configure", "get", "sso_session", "--profile", &prof_clone]);
        let sso_session = session_cmd.output().ok().and_then(|o| {
            if o.status.success() {
                let val = String::from_utf8_lossy(&o.stdout).trim().to_string();
                if !val.is_empty() {
                    Some(val)
                } else {
                    None
                }
            } else {
                None
            }
        });

        let cmd_str = if let Some(ref session) = sso_session {
            format!("aws sso login --sso-session {}", session)
        } else {
            format!("aws sso login --profile {}", prof_clone)
        };

        Ok(ApiResponse::ok(cmd_str))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn open_terminal_sso_login(
    profile: Option<String>,
) -> Result<ApiResponse<String>, String> {
    let prof = profile.unwrap_or_else(|| "default".to_string());
    let prof_clone = prof.clone();

    tokio::task::spawn_blocking(move || {
        let mut session_cmd = get_aws_cmd();
        session_cmd.args(["configure", "get", "sso_session", "--profile", &prof_clone]);
        let sso_session = session_cmd.output().ok().and_then(|o| {
            if o.status.success() {
                let val = String::from_utf8_lossy(&o.stdout).trim().to_string();
                if !val.is_empty() {
                    Some(val)
                } else {
                    None
                }
            } else {
                None
            }
        });

        let cmd_str = if let Some(ref session) = sso_session {
            format!("aws sso login --sso-session {}", session)
        } else {
            format!("aws sso login --profile {}", prof_clone)
        };

        // Open in macOS Terminal with proper PATH
        let script = format!(
            "tell application \"Terminal\"\nactivate\ndo script \"export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH; echo '=== k8sUI: Authenticating AWS SSO ==='; {}; echo 'Authentication complete! You can return to k8sUI.'\"\nend tell",
            cmd_str
        );

        let res = std::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output();

        match res {
            Ok(out) if out.status.success() => Ok(ApiResponse::ok(cmd_str)),
            Ok(out) => {
                let err = String::from_utf8_lossy(&out.stderr).to_string();
                Ok(ApiResponse::err(if err.trim().is_empty() {
                    String::from_utf8_lossy(&out.stdout).to_string()
                } else {
                    err
                }))
            }
            Err(e) => Ok(ApiResponse::err(format!("Failed to launch Terminal: {}", e))),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

// --- Helm Release Lifecycle Management ---

#[tauri::command]
pub async fn get_helm_release_details(
    name: String,
    namespace: Option<String>,
    state: State<'_, AppState>,
) -> Result<ApiResponse<crate::connector::HelmReleaseDetails>, String> {
    let mgr = match manager_for(&state).await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e)),
    };

    match mgr
        .get_helm_release_details(&name, namespace.as_deref())
        .await
    {
        Ok(res) => {
            let cluster_id = state
                .session
                .get_active_summary()
                .await
                .map(|s| s.id)
                .unwrap_or_else(|| "unknown".to_string());
            state
                .audit
                .log(
                    &cluster_id,
                    "cluster",
                    "get_helm_release_details",
                    &format!("{}/{}", namespace.as_deref().unwrap_or("default"), name),
                    "desktop-ui",
                    None,
                    "success",
                )
                .await;
            Ok(ApiResponse::ok(res))
        }
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn install_helm_release(
    release_name: String,
    namespace: String,
    chart: String,
    version: Option<String>,
    values_yaml: Option<String>,
    create_namespace: bool,
    state: State<'_, AppState>,
) -> Result<ApiResponse<String>, String> {
    if state.session.is_read_only().await {
        return Ok(ApiResponse::err(
            "Cannot install Helm release in Read-Only mode. Please unlock write mode first."
                .to_string(),
        ));
    }

    let mgr = match manager_for(&state).await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e)),
    };

    let cluster_context = state.session.get_active_summary().await.map(|s| s.name);

    match mgr
        .install_helm_release(
            &release_name,
            &namespace,
            &chart,
            version.as_deref(),
            values_yaml.as_deref(),
            create_namespace,
            cluster_context.as_deref(),
        )
        .await
    {
        Ok(msg) => {
            let cluster_id = state
                .session
                .get_active_summary()
                .await
                .map(|s| s.id)
                .unwrap_or_else(|| "unknown".to_string());
            state
                .audit
                .log(
                    &cluster_id,
                    "cluster",
                    "install_helm_release",
                    &format!("{}/{}", namespace, release_name),
                    "desktop-ui",
                    Some(&format!("Installed chart {}", chart)),
                    "success",
                )
                .await;
            Ok(ApiResponse::ok(msg))
        }
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn upgrade_helm_release(
    release_name: String,
    namespace: String,
    chart: Option<String>,
    version: Option<String>,
    values_yaml: Option<String>,
    reset_values: bool,
    state: State<'_, AppState>,
) -> Result<ApiResponse<String>, String> {
    if state.session.is_read_only().await {
        return Ok(ApiResponse::err(
            "Cannot upgrade Helm release in Read-Only mode. Please unlock write mode first."
                .to_string(),
        ));
    }

    let mgr = match manager_for(&state).await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e)),
    };

    let cluster_context = state.session.get_active_summary().await.map(|s| s.name);

    match mgr
        .upgrade_helm_release(
            &release_name,
            &namespace,
            chart.as_deref(),
            version.as_deref(),
            values_yaml.as_deref(),
            reset_values,
            cluster_context.as_deref(),
        )
        .await
    {
        Ok(msg) => {
            let cluster_id = state
                .session
                .get_active_summary()
                .await
                .map(|s| s.id)
                .unwrap_or_else(|| "unknown".to_string());
            state
                .audit
                .log(
                    &cluster_id,
                    "cluster",
                    "upgrade_helm_release",
                    &format!("{}/{}", namespace, release_name),
                    "desktop-ui",
                    Some("Upgraded Helm release values/version"),
                    "success",
                )
                .await;
            Ok(ApiResponse::ok(msg))
        }
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn rollback_helm_release(
    release_name: String,
    namespace: String,
    revision: i32,
    state: State<'_, AppState>,
) -> Result<ApiResponse<String>, String> {
    if state.session.is_read_only().await {
        return Ok(ApiResponse::err(
            "Cannot rollback Helm release in Read-Only mode. Please unlock write mode first."
                .to_string(),
        ));
    }

    let mgr = match manager_for(&state).await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e)),
    };

    let cluster_context = state.session.get_active_summary().await.map(|s| s.name);

    match mgr
        .rollback_helm_release(
            &release_name,
            &namespace,
            revision,
            cluster_context.as_deref(),
        )
        .await
    {
        Ok(msg) => {
            let cluster_id = state
                .session
                .get_active_summary()
                .await
                .map(|s| s.id)
                .unwrap_or_else(|| "unknown".to_string());
            state
                .audit
                .log(
                    &cluster_id,
                    "cluster",
                    "rollback_helm_release",
                    &format!("{}/{}", namespace, release_name),
                    "desktop-ui",
                    Some(&format!("Rolled back to revision {}", revision)),
                    "success",
                )
                .await;
            Ok(ApiResponse::ok(msg))
        }
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn uninstall_helm_release(
    release_name: String,
    namespace: String,
    keep_history: bool,
    state: State<'_, AppState>,
) -> Result<ApiResponse<String>, String> {
    if state.session.is_read_only().await {
        return Ok(ApiResponse::err(
            "Cannot uninstall Helm release in Read-Only mode. Please unlock write mode first."
                .to_string(),
        ));
    }

    let mgr = match manager_for(&state).await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e)),
    };

    let cluster_context = state.session.get_active_summary().await.map(|s| s.name);

    match mgr
        .uninstall_helm_release(
            &release_name,
            &namespace,
            keep_history,
            cluster_context.as_deref(),
        )
        .await
    {
        Ok(msg) => {
            let cluster_id = state
                .session
                .get_active_summary()
                .await
                .map(|s| s.id)
                .unwrap_or_else(|| "unknown".to_string());
            state
                .audit
                .log(
                    &cluster_id,
                    "cluster",
                    "uninstall_helm_release",
                    &format!("{}/{}", namespace, release_name),
                    "desktop-ui",
                    Some("Uninstalled Helm release"),
                    "success",
                )
                .await;
            Ok(ApiResponse::ok(msg))
        }
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn list_helm_repositories(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<serde_json::Value>>, String> {
    let mgr = match manager_for(&state).await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e)),
    };

    match mgr.list_helm_repositories().await {
        Ok(list) => Ok(ApiResponse::ok(list)),
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn add_helm_repository(
    name: String,
    url: String,
    state: State<'_, AppState>,
) -> Result<ApiResponse<String>, String> {
    let mgr = match manager_for(&state).await {
        Ok(m) => m,
        Err(e) => return Ok(ApiResponse::err(e)),
    };

    match mgr.add_helm_repository(&name, &url).await {
        Ok(msg) => Ok(ApiResponse::ok(msg)),
        Err(e) => Ok(ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<ApiResponse<()>, String> {
    // Security: only allow https:// and http:// schemes to prevent command injection
    // via file://, javascript:, or shell-injectable strings.
    let scheme_ok = url.starts_with("https://") || url.starts_with("http://");
    if !scheme_ok {
        return Ok(ApiResponse::err(format!(
            "Rejected URL with disallowed scheme: {}",
            url
        )));
    }

    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&url).spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(&["/C", "start", &url])
            .spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
    }
    Ok(ApiResponse::ok(()))
}

#[tauri::command]
pub async fn terminal_resize(
    state: tauri::State<'_, crate::AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<crate::commands::ApiResponse<()>, String> {
    match state.terminal.resize(&session_id, cols, rows).await {
        Ok(_) => Ok(crate::commands::ApiResponse::ok(())),
        Err(e) => Ok(crate::commands::ApiResponse::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn save_file(
    path: String,
    contents: String,
) -> Result<crate::commands::ApiResponse<()>, String> {
    match std::fs::write(&path, contents) {
        Ok(_) => Ok(crate::commands::ApiResponse::ok(())),
        Err(e) => Ok(crate::commands::ApiResponse::err(e.to_string())),
    }
}
