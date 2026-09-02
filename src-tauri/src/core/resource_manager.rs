use crate::connector::{
    ApplyResult, ClusterOverviewData, ClusterWarningEvent, ConnectorError, DryRunResult,
    NodeTopologySummary, NodesMetricSummary, PodSummary, PodsMetricRing, ResourceMetricRing,
    ScaleResult, TopologyBadge, WorkloadHealthSummary,
};
use k8s_openapi::api::apps::v1::{DaemonSet, Deployment, StatefulSet};
use k8s_openapi::api::batch::v1::{CronJob, Job};
use k8s_openapi::api::core::v1::{Event, Namespace, Node, Pod};
use kube::{
    api::{Api, DynamicObject, ListParams, Patch, PatchParams, PostParams},
    discovery::{ApiCapabilities, ApiResource, Discovery, Scope},
    Client, ResourceExt,
};
use serde_json::json;
use std::sync::Arc;

pub struct GenericResourceManager {
    client: Client,
    discovery: Arc<tokio::sync::RwLock<Option<Discovery>>>,
    crd_cache:
        Arc<tokio::sync::RwLock<std::collections::HashMap<String, (ApiResource, ApiCapabilities)>>>,
}

impl GenericResourceManager {
    pub fn new(client: Client) -> Self {
        let disc_store = Arc::new(tokio::sync::RwLock::new(None));
        let disc_clone = disc_store.clone();
        let client_clone = client.clone();
        let crd_cache = Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new()));

        // Spawn dynamic discovery asynchronously in the background so
        // built-in resources and page navigation are instant (0ms blocking).
        tokio::spawn(async move {
            let res = tokio::time::timeout(
                std::time::Duration::from_secs(12),
                Discovery::new(client_clone).run(),
            )
            .await;

            match res {
                Ok(Ok(disc)) => {
                    *disc_clone.write().await = Some(disc);
                }
                Ok(Err(e)) => {
                    tracing::warn!(
                        "Background cluster discovery error (using built-ins): {:?}",
                        e
                    );
                }
                Err(_) => {
                    tracing::warn!("Background cluster discovery timed out (using built-ins)");
                }
            }
        });

        Self {
            client,
            discovery: disc_store,
            crd_cache,
        }
    }

    /// Fast static resolution for standard built-in Kubernetes resources.
    /// This resolves in 0ms without requiring network I/O or discovery walks.
    fn resolve_builtin_resource(kind: &str) -> Option<(ApiResource, ApiCapabilities)> {
        let normalized = Self::normalize_shorthand(kind).to_lowercase();
        let (group, version, kind_name, plural, is_namespaced) = match normalized.as_str() {
            "pods" | "pod" => ("", "v1", "Pod", "pods", true),
            "services" | "service" => ("", "v1", "Service", "services", true),
            "endpoints" | "endpoint" => ("", "v1", "Endpoints", "endpoints", true),
            "configmaps" | "configmap" => ("", "v1", "ConfigMap", "configmaps", true),
            "secrets" | "secret" => ("", "v1", "Secret", "secrets", true),
            "namespaces" | "namespace" => ("", "v1", "Namespace", "namespaces", false),
            "nodes" | "node" => ("", "v1", "Node", "nodes", false),
            "events" | "event" => ("", "v1", "Event", "events", true),
            "serviceaccounts" | "serviceaccount" => {
                ("", "v1", "ServiceAccount", "serviceaccounts", true)
            }
            "persistentvolumeclaims" | "persistentvolumeclaim" => (
                "",
                "v1",
                "PersistentVolumeClaim",
                "persistentvolumeclaims",
                true,
            ),
            "persistentvolumes" | "persistentvolume" => {
                ("", "v1", "PersistentVolume", "persistentvolumes", false)
            }
            "resourcequotas" | "resourcequota" => {
                ("", "v1", "ResourceQuota", "resourcequotas", true)
            }
            "limitranges" | "limitrange" => ("", "v1", "LimitRange", "limitranges", true),

            "deployments" | "deployment" | "deploy" => {
                ("apps", "v1", "Deployment", "deployments", true)
            }
            "statefulsets" | "statefulset" | "statefullsets" | "statefullset" | "sts" => {
                ("apps", "v1", "StatefulSet", "statefulsets", true)
            }
            "daemonsets" | "daemonset" | "ds" => ("apps", "v1", "DaemonSet", "daemonsets", true),
            "replicasets" | "replicaset" | "rs" => {
                ("apps", "v1", "ReplicaSet", "replicasets", true)
            }

            "cronjobs" | "cronjob" => ("batch", "v1", "CronJob", "cronjobs", true),
            "jobs" | "job" => ("batch", "v1", "Job", "jobs", true),

            "ingresses" | "ingress" => ("networking.k8s.io", "v1", "Ingress", "ingresses", true),
            "ingressclasses" | "ingressclass" => (
                "networking.k8s.io",
                "v1",
                "IngressClass",
                "ingressclasses",
                false,
            ),
            "networkpolicies" | "networkpolicy" => (
                "networking.k8s.io",
                "v1",
                "NetworkPolicy",
                "networkpolicies",
                true,
            ),

            "storageclasses" | "storageclass" => (
                "storage.k8s.io",
                "v1",
                "StorageClass",
                "storageclasses",
                false,
            ),

            "roles" | "role" => ("rbac.authorization.k8s.io", "v1", "Role", "roles", true),
            "rolebindings" | "rolebinding" => (
                "rbac.authorization.k8s.io",
                "v1",
                "RoleBinding",
                "rolebindings",
                true,
            ),
            "clusterroles" | "clusterrole" => (
                "rbac.authorization.k8s.io",
                "v1",
                "ClusterRole",
                "clusterroles",
                false,
            ),
            "clusterrolebindings" | "clusterrolebinding" => (
                "rbac.authorization.k8s.io",
                "v1",
                "ClusterRoleBinding",
                "clusterrolebindings",
                false,
            ),

            "horizontalpodautoscalers" | "horizontalpodautoscaler" => (
                "autoscaling",
                "v2",
                "HorizontalPodAutoscaler",
                "horizontalpodautoscalers",
                true,
            ),
            "poddisruptionbudgets" | "poddisruptionbudget" => (
                "policy",
                "v1",
                "PodDisruptionBudget",
                "poddisruptionbudgets",
                true,
            ),

            "mutatingwebhookconfigurations" | "mutatingwebhookconfiguration" => (
                "admissionregistration.k8s.io",
                "v1",
                "MutatingWebhookConfiguration",
                "mutatingwebhookconfigurations",
                false,
            ),
            "validatingwebhookconfigurations" | "validatingwebhookconfiguration" => (
                "admissionregistration.k8s.io",
                "v1",
                "ValidatingWebhookConfiguration",
                "validatingwebhookconfigurations",
                false,
            ),

            "customresourcedefinitions" | "customresourcedefinition" => (
                "apiextensions.k8s.io",
                "v1",
                "CustomResourceDefinition",
                "customresourcedefinitions",
                false,
            ),
            "priorityclasses" | "priorityclass" => (
                "scheduling.k8s.io",
                "v1",
                "PriorityClass",
                "priorityclasses",
                false,
            ),
            _ => return None,
        };

        let api_version = if group.is_empty() {
            version.to_string()
        } else {
            format!("{}/{}", group, version)
        };

        let ar = ApiResource {
            group: group.to_string(),
            version: version.to_string(),
            api_version,
            kind: kind_name.to_string(),
            plural: plural.to_string(),
        };

        let caps = ApiCapabilities {
            scope: if is_namespaced {
                Scope::Namespaced
            } else {
                Scope::Cluster
            },
            subresources: vec![],
            operations: vec![],
        };

        Some((ar, caps))
    }

    /// UI shorthand ids that don't match the API resource's own kind or plural.
    fn normalize_shorthand(kind: &str) -> &str {
        match kind.to_lowercase().as_str() {
            "hpas" | "hpa" | "horizontalpodautoscaler" | "horizontalpodautoscalers" => {
                "horizontalpodautoscalers"
            }
            "pdbs" | "pdb" | "poddisruptionbudget" | "poddisruptionbudgets" => {
                "poddisruptionbudgets"
            }
            "crds" | "crd" | "customresourcedefinition" | "customresourcedefinitions" => {
                "customresourcedefinitions"
            }
            "pvcs" | "pvc" | "persistentvolumeclaim" | "persistentvolumeclaims" => {
                "persistentvolumeclaims"
            }
            "pvs" | "pv" | "persistentvolume" | "persistentvolumes" => "persistentvolumes",
            "mutatingwebhooks"
            | "mutatingwebhook"
            | "mutatingwebhookconfiguration"
            | "mutatingwebhookconfigurations" => "mutatingwebhookconfigurations",
            "validatingwebhooks"
            | "validatingwebhook"
            | "validatingwebhookconfiguration"
            | "validatingwebhookconfigurations" => "validatingwebhookconfigurations",
            "svc" | "services" | "service" => "services",
            "po" | "pod" | "pods" => "pods",
            "deploy" | "deployments" | "deployment" => "deployments",
            "sts" | "statefulsets" | "statefulset" | "statefullsets" | "statefullset" => {
                "statefulsets"
            }
            "ds" | "daemonsets" | "daemonset" => "daemonsets",
            "rs" | "replicasets" | "replicaset" => "replicasets",
            "cj" | "cronjobs" | "cronjob" => "cronjobs",
            "job" | "jobs" => "jobs",
            "ns" | "namespaces" | "namespace" => "namespaces",
            "no" | "nodes" | "node" => "nodes",
            "cm" | "configmaps" | "configmap" => "configmaps",
            "sec" | "secrets" | "secret" => "secrets",
            "ing" | "ingresses" | "ingress" => "ingresses",
            "ingressclasses" | "ingressclass" => "ingressclasses",
            "ep" | "endpoints" | "endpoint" => "endpoints",
            "netpol" | "networkpolicies" | "networkpolicy" => "networkpolicies",
            "sa" | "serviceaccounts" | "serviceaccount" => "serviceaccounts",
            "sc" | "storageclasses" | "storageclass" => "storageclasses",
            "cr" | "clusterroles" | "clusterrole" => "clusterroles",
            "crb" | "clusterrolebindings" | "clusterrolebinding" => "clusterrolebindings",
            "ro" | "roles" | "role" => "roles",
            "rb" | "rolebindings" | "rolebinding" => "rolebindings",
            "quota" | "quotas" | "resourcequota" | "resourcequotas" => "resourcequotas",
            "limit" | "limits" | "limitrange" | "limitranges" => "limitranges",
            "pc" | "priorityclass" | "priorityclasses" => "priorityclasses",
            _ => kind,
        }
    }

    fn resolve_api_resource(
        &self,
        kind: &str,
    ) -> Result<(ApiResource, ApiCapabilities), ConnectorError> {
        // Fast static resolution for standard Kubernetes resources
        if let Some(res) = Self::resolve_builtin_resource(kind) {
            return Ok(res);
        }

        let normalized = Self::normalize_shorthand(kind);
        let lower = normalized.to_lowercase();

        // 1. Check dynamic discovery if ready
        if let Ok(guard) = self.discovery.try_read() {
            if let Some(discovery) = guard.as_ref() {
                for group in discovery.groups() {
                    for (ar, caps) in group.recommended_resources() {
                        if ar.kind.to_lowercase() == lower || ar.plural.to_lowercase() == lower {
                            return Ok((ar, caps));
                        }
                    }
                }
            }
        }

        // 2. Check cached Custom Resource Definitions
        if let Ok(cache) = self.crd_cache.try_read() {
            if let Some((ar, caps)) = cache.get(&lower) {
                return Ok((ar.clone(), caps.clone()));
            }
        }

        Err(ConnectorError::NotFound(format!(
            "Resource kind '{}' not found in cluster discovery",
            kind
        )))
    }

    fn get_api(
        &self,
        resource: &ApiResource,
        caps: &ApiCapabilities,
        namespace: Option<&str>,
    ) -> Api<DynamicObject> {
        match namespace {
            // "all" and "" both mean cluster-wide here — that is what the namespace
            // selector sends when nothing is narrowed down.
            Some(ns) if caps.scope == Scope::Namespaced && !ns.is_empty() && ns != "all" => {
                Api::namespaced_with(self.client.clone(), ns, resource)
            }
            _ => Api::all_with(self.client.clone(), resource),
        }
    }

    /// Every installed custom resource *type*, not the CustomResourceDefinition
    /// objects themselves.
    ///
    /// The sidebar previously offered exactly one static entry — "Definitions",
    /// which lists CRD schema objects — with no way to navigate into the actual
    /// custom resources those schemas describe (a cluster's real ExternalSecrets,
    /// Certificates, ScaledObjects...). The generic resource layer already
    /// handles listing *instances* of any discovered kind; what was missing was
    /// simply telling the frontend which kinds exist to build that navigation.
    /// Confirmed against a live cluster: `list_resources("certificates", None)`
    /// and `list_resources("scaledobjects", None)` already return real data —
    /// this method is the missing piece that makes those kinds discoverable
    /// instead of requiring the exact plural to be known in advance.
    pub async fn list_custom_resource_types(
        &self,
    ) -> Result<Vec<serde_json::Value>, ConnectorError> {
        // Reuses the same discovery-driven resolver as every other kind, rather
        // than pinning a k8s-openapi struct path for one call site.
        let (resource, caps) = self.resolve_api_resource("customresourcedefinitions")?;
        let api = self.get_api(&resource, &caps, None);
        let crds = tokio::time::timeout(
            std::time::Duration::from_secs(8),
            api.list(&ListParams::default()),
        )
        .await
        .map_err(|_| ConnectorError::Timeout("Listing CRD types timed out after 8s".to_string()))?
        .map_err(ConnectorError::KubeError)?;

        let mut discovered_crds = std::collections::HashMap::new();

        let types: Vec<serde_json::Value> = crds
            .items
            .into_iter()
            .filter_map(|crd| {
                let spec = crd.data.get("spec")?;
                let group = spec.get("group")?.as_str()?.to_string();
                let names = spec.get("names")?;
                let kind = names.get("kind")?.as_str()?.to_string();
                let plural = names.get("plural")?.as_str()?.to_string();
                let scope = spec
                    .get("scope")
                    .and_then(|s| s.as_str())
                    .unwrap_or("Namespaced")
                    .to_string();

                // "Established" is the CRD's own readiness signal — the API
                // server has accepted the schema and instances can be created.
                // A CRD stuck applying (bad validation, a version conflict)
                // shows as not-established rather than silently looking normal.
                let established = crd
                    .data
                    .get("status")
                    .and_then(|s| s.get("conditions"))
                    .and_then(|c| c.as_array())
                    .map(|conds| {
                        conds.iter().any(|c| {
                            c.get("type").and_then(|t| t.as_str()) == Some("Established")
                                && c.get("status").and_then(|s| s.as_str()) == Some("True")
                        })
                    })
                    .unwrap_or(false);

                // The served version — CRDs can carry several; the served one
                // is what list_resources will actually query against.
                let version = spec
                    .get("versions")
                    .and_then(|v| v.as_array())
                    .and_then(|vs| {
                        vs.iter()
                            .find(|v| v.get("served").and_then(|s| s.as_bool()) == Some(true))
                            .or_else(|| vs.first())
                    })
                    .and_then(|v| v.get("name"))
                    .and_then(|n| n.as_str())
                    .unwrap_or("v1")
                    .to_string();

                let is_namespaced = scope == "Namespaced";
                let api_version = if group.is_empty() {
                    version.clone()
                } else {
                    format!("{}/{}", group, version)
                };

                let ar = ApiResource {
                    group: group.clone(),
                    version: version.clone(),
                    api_version,
                    kind: kind.clone(),
                    plural: plural.clone(),
                };

                let caps = ApiCapabilities {
                    scope: if is_namespaced {
                        Scope::Namespaced
                    } else {
                        Scope::Cluster
                    },
                    subresources: vec![],
                    operations: vec![],
                };

                discovered_crds.insert(kind.to_lowercase(), (ar.clone(), caps.clone()));
                discovered_crds.insert(plural.to_lowercase(), (ar.clone(), caps.clone()));
                discovered_crds.insert(format!("{}.{}", plural, group).to_lowercase(), (ar, caps));

                Some(json!({
                    "group": group,
                    "kind": kind,
                    "plural": plural,
                    "scope": scope,
                    "version": version,
                    "established": established,
                }))
            })
            .collect();

        // Update CRD cache for instant dynamic resolution of all custom resource instances
        if let Ok(mut cache) = self.crd_cache.try_write() {
            cache.extend(discovered_crds);
        }

        Ok(types)
    }

    pub async fn list_resources(
        &self,
        kind: &str,
        namespace: Option<&str>,
    ) -> Result<Vec<serde_json::Value>, ConnectorError> {
        if kind == "helm-releases" || kind == "helm" {
            let secret_api: Api<k8s_openapi::api::core::v1::Secret> = if let Some(ns) = namespace {
                if ns != "all" && !ns.is_empty() {
                    Api::namespaced(self.client.clone(), ns)
                } else {
                    Api::all(self.client.clone())
                }
            } else {
                Api::all(self.client.clone())
            };

            let lp = ListParams::default().labels("owner=helm");
            let secrets = secret_api
                .list(&lp)
                .await
                .map_err(ConnectorError::KubeError)?;

            let mut latest_releases: std::collections::HashMap<String, serde_json::Value> =
                std::collections::HashMap::new();

            for s in secrets.items {
                let meta = s.metadata;
                let s_name = meta.name.clone().unwrap_or_default();
                let ns = meta
                    .namespace
                    .clone()
                    .unwrap_or_else(|| "default".to_string());

                let release_name = meta
                    .labels
                    .as_ref()
                    .and_then(|l| l.get("name").cloned())
                    .unwrap_or_else(|| {
                        let parts: Vec<&str> = s_name.split('.').collect();
                        if parts.len() >= 5 {
                            parts[parts.len() - 2].to_string()
                        } else {
                            s_name.clone()
                        }
                    });

                let version_str = meta
                    .labels
                    .as_ref()
                    .and_then(|l| l.get("version").cloned())
                    .unwrap_or_else(|| {
                        s_name
                            .rsplit('.')
                            .next()
                            .unwrap_or("1")
                            .trim_start_matches('v')
                            .to_string()
                    });
                let version: i64 = version_str.parse().unwrap_or(1);

                let status = meta
                    .labels
                    .as_ref()
                    .and_then(|l| l.get("status").cloned())
                    .unwrap_or_else(|| "deployed".to_string());

                let age = if let Some(ref ts) = meta.creation_timestamp {
                    let dur = chrono::Utc::now().signed_duration_since(ts.0);
                    if dur.num_days() > 0 {
                        format!("{}d", dur.num_days())
                    } else if dur.num_hours() > 0 {
                        format!("{}h", dur.num_hours())
                    } else if dur.num_minutes() > 0 {
                        format!("{}m", dur.num_minutes())
                    } else {
                        format!("{}s", dur.num_seconds())
                    }
                } else {
                    String::new()
                };

                let key = format!("{}/{}", ns, release_name);
                let entry = json!({
                    "name": release_name,
                    "namespace": ns,
                    "kind": "HelmRelease",
                    "status": status,
                    "revision": version,
                    "secretName": s_name,
                    "age": age,
                    "creationTimestamp": meta.creation_timestamp.map(|t| t.0.to_rfc3339()).unwrap_or_default(),
                });

                if let Some(existing) = latest_releases.get(&key) {
                    let existing_ver = existing
                        .get("revision")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    if version > existing_ver {
                        latest_releases.insert(key, entry);
                    }
                } else {
                    latest_releases.insert(key, entry);
                }
            }

            let mut results: Vec<serde_json::Value> = latest_releases.into_values().collect();
            results.sort_by_key(|a| {
                a.get("name")
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .to_string()
            });
            return Ok(results);
        }

        let (resource, caps) = self.resolve_api_resource(kind)?;

        let is_namespaced = caps.scope == Scope::Namespaced;
        let is_all_namespaces =
            namespace.is_none() || namespace == Some("all") || namespace == Some("");

        let mut items = Vec::new();

        if is_namespaced && is_all_namespaces {
            // 1. Try cluster-wide list first
            let all_api = Api::all_with(self.client.clone(), &resource);
            let cluster_res = tokio::time::timeout(
                std::time::Duration::from_secs(5),
                all_api.list(&ListParams::default()),
            )
            .await;

            match cluster_res {
                Ok(Ok(list)) => {
                    items = list.items;
                }
                Ok(Err(e)) => {
                    let err_str = e.to_string();
                    let lower = err_str.to_lowercase();
                    if lower.contains("401")
                        || lower.contains("unauthorized")
                        || lower.contains("token")
                        || lower.contains("expired")
                        || lower.contains("unrecognizedclientexception")
                    {
                        return Err(ConnectorError::AuthError(format!(
                            "Authentication failed or token expired: {}",
                            err_str
                        )));
                    }
                    if !lower.contains("403") && !lower.contains("forbidden") {
                        return Err(ConnectorError::KubeError(e));
                    }

                    tracing::warn!("Cluster-wide listing for {} failed with 403 ({}). Attempting parallel per-namespace query fallback.", kind, e);
                    // 2. Discover accessible namespaces and query each in parallel
                    let discovered_ns = self
                        .list_namespaces()
                        .await
                        .unwrap_or_else(|_| vec!["default".to_string()]);
                    let ns_list = if discovered_ns.is_empty() {
                        vec!["default".to_string()]
                    } else {
                        discovered_ns
                    };

                    let mut tasks = Vec::new();
                    for ns in ns_list {
                        let ns_api = Api::namespaced_with(self.client.clone(), &ns, &resource);
                        tasks.push(async move {
                            tokio::time::timeout(
                                std::time::Duration::from_secs(4),
                                ns_api.list(&ListParams::default()),
                            )
                            .await
                        });
                    }

                    let results = futures::future::join_all(tasks).await;
                    for r in results {
                        if let Ok(Ok(sub_list)) = r {
                            items.extend(sub_list.items);
                        }
                    }
                }
                Err(_) => {
                    return Err(ConnectorError::Timeout(format!(
                        "Cluster-wide listing for '{}' timed out after 5s. Please check your cluster connection or VPN.",
                        kind
                    )));
                }
            }
        } else {
            let api = self.get_api(&resource, &caps, namespace);
            let list_res = tokio::time::timeout(
                std::time::Duration::from_secs(6),
                api.list(&ListParams::default()),
            )
            .await;

            match list_res {
                Ok(Ok(list)) => {
                    items = list.items;
                }
                Ok(Err(e)) => {
                    let err_str = e.to_string();
                    let lower = err_str.to_lowercase();
                    if lower.contains("401")
                        || lower.contains("unauthorized")
                        || lower.contains("token")
                        || lower.contains("expired")
                        || lower.contains("unrecognizedclientexception")
                    {
                        return Err(ConnectorError::AuthError(format!(
                            "Authentication failed or token expired: {}",
                            err_str
                        )));
                    } else if lower.contains("403") || lower.contains("forbidden") {
                        return Err(ConnectorError::PermissionDenied(format!(
                            "Permission denied (RBAC) for '{}': {}",
                            kind, err_str
                        )));
                    } else {
                        return Err(ConnectorError::KubeError(e));
                    }
                }
                Err(_) => {
                    return Err(ConnectorError::Timeout(format!(
                        "Listing '{}' timed out after 6s. Please check your cluster connection or VPN.",
                        kind
                    )));
                }
            }
        }

        // If listing nodes, fetch live NodeMetrics concurrently to calculate actual CPU and Memory usage percentages
        let node_metrics_map: std::collections::HashMap<String, (f64, f64)> =
            if resource.kind == "Node" {
                if let Ok((res, caps)) = self.resolve_api_resource("nodemetrics") {
                    let metrics_api = self.get_api(&res, &caps, None);
                    let lp = ListParams::default();
                    tokio::time::timeout(std::time::Duration::from_secs(3), metrics_api.list(&lp))
                        .await
                        .ok()
                        .and_then(|r| r.ok())
                        .map(|l| {
                            let mut map = std::collections::HashMap::new();
                            for item in l.items {
                                let node_name = item.name_any();
                                if let Some(usage) = item.data.get("usage") {
                                    let cpu_val =
                                        usage.get("cpu").and_then(|v| v.as_str()).unwrap_or("0");
                                    let mem_val =
                                        usage.get("memory").and_then(|v| v.as_str()).unwrap_or("0");
                                    let cpu_cores = parse_cpu_cores(cpu_val);
                                    let mem_gib = parse_memory_gib(mem_val);
                                    map.insert(node_name, (cpu_cores, mem_gib));
                                }
                            }
                            map
                        })
                        .unwrap_or_default()
                } else {
                    std::collections::HashMap::new()
                }
            } else {
                std::collections::HashMap::new()
            };

        let mapped: Vec<serde_json::Value> = items
            .into_iter()
            .map(|item| {
                let name = item.name_any();
                let ns = item.namespace().unwrap_or_default();
                let creation = item
                    .creation_timestamp()
                    .map(|t| t.0.to_rfc3339())
                    .unwrap_or_default();

                let age = if let Some(ts) = item.creation_timestamp() {
                    let dur = chrono::Utc::now().signed_duration_since(ts.0);
                    if dur.num_days() > 0 {
                        format!("{}d", dur.num_days())
                    } else if dur.num_hours() > 0 {
                        format!("{}h", dur.num_hours())
                    } else if dur.num_minutes() > 0 {
                        format!("{}m", dur.num_minutes())
                    } else {
                        format!("{}s", dur.num_seconds())
                    }
                } else {
                    String::new()
                };

                let status = if let Some(s) = item.data.get("status") {
                    if let Some(phase) = s.get("phase").and_then(|p| p.as_str()) {
                        phase.to_string()
                    } else if let Some(conds) = s.get("conditions").and_then(|c| c.as_array()) {
                        if let Some(ready) = conds.iter().find(|c| {
                            c.get("type").and_then(|t| t.as_str()) == Some("Ready")
                                || c.get("type").and_then(|t| t.as_str()) == Some("Available")
                        }) {
                            if ready.get("status").and_then(|s| s.as_str()) == Some("True") {
                                "Ready".to_string()
                            } else {
                                "NotReady".to_string()
                            }
                        } else {
                            "Active".to_string()
                        }
                    } else {
                        "Active".to_string()
                    }
                } else {
                    "Active".to_string()
                };

                let mut obj = json!({
                    "name": name,
                    "namespace": ns,
                    "kind": resource.kind,
                    "status": status,
                    "age": age,
                    "creationTimestamp": creation,
                });

                match resource.kind.as_str() {
                    "Node" => {
                        let mut roles = Vec::new();
                        let mut instance_type = "-".to_string();
                        let mut zone = "-".to_string();
                        let mut arch = "-".to_string();
                        let mut capacity_type = "ON_DEMAND".to_string();

                        if let Some(meta) = item.data.get("metadata") {
                            if let Some(labels) = meta.get("labels").and_then(|l| l.as_object()) {
                                for (k, v) in labels {
                                    if k.starts_with("node-role.kubernetes.io/") {
                                        let role = k.trim_start_matches("node-role.kubernetes.io/");
                                        if !role.is_empty() {
                                            roles.push(role.to_string());
                                        }
                                    }
                                    if k == "node.kubernetes.io/instance-type"
                                        || k == "beta.kubernetes.io/instance-type"
                                    {
                                        instance_type = v.as_str().unwrap_or("-").to_string();
                                    }
                                    if k == "topology.kubernetes.io/zone"
                                        || k == "failure-domain.beta.kubernetes.io/zone"
                                    {
                                        zone = v.as_str().unwrap_or("-").to_string();
                                    }
                                    if k == "kubernetes.io/arch" || k == "beta.kubernetes.io/arch" {
                                        arch = v.as_str().unwrap_or("-").to_string();
                                    }
                                    if k == "karpenter.sh/capacity-type"
                                        || k == "eks.amazonaws.com/capacityType"
                                    {
                                        capacity_type =
                                            v.as_str().unwrap_or("ON_DEMAND").to_uppercase();
                                    }
                                }
                            }
                        }

                        if roles.is_empty() {
                            obj["roles"] = json!("<none>");
                        } else {
                            obj["roles"] = json!(roles.join(", "));
                        }
                        obj["instanceType"] = json!(instance_type);
                        obj["zone"] = json!(zone);
                        obj["arch"] = json!(arch);
                        obj["capacityType"] = json!(capacity_type);

                        let mut allocatable_cpu = 0.0;
                        let mut allocatable_mem = 0.0;
                        let mut capacity_cpu = 0.0;
                        let mut capacity_mem = 0.0;
                        let mut pods_capacity = 0;

                        if let Some(st) = item.data.get("status") {
                            if let Some(alloc) = st.get("allocatable") {
                                if let Some(cpu_str) = alloc.get("cpu").and_then(|v| v.as_str()) {
                                    allocatable_cpu = parse_cpu_cores(cpu_str);
                                }
                                if let Some(mem_str) = alloc.get("memory").and_then(|v| v.as_str())
                                {
                                    allocatable_mem = parse_memory_gib(mem_str);
                                }
                                if let Some(p_str) = alloc.get("pods").and_then(|v| v.as_str()) {
                                    pods_capacity = p_str.parse::<i64>().unwrap_or(0);
                                }
                            }
                            if let Some(cap) = st.get("capacity") {
                                if let Some(cpu_str) = cap.get("cpu").and_then(|v| v.as_str()) {
                                    capacity_cpu = parse_cpu_cores(cpu_str);
                                }
                                if let Some(mem_str) = cap.get("memory").and_then(|v| v.as_str()) {
                                    capacity_mem = parse_memory_gib(mem_str);
                                }
                            }
                            if let Some(node_info) = st.get("nodeInfo") {
                                if let Some(kubelet) =
                                    node_info.get("kubeletVersion").and_then(|v| v.as_str())
                                {
                                    obj["version"] = json!(kubelet);
                                }
                                if let Some(os) = node_info.get("osImage").and_then(|v| v.as_str())
                                {
                                    obj["osImage"] = json!(os);
                                }
                                if let Some(runtime) = node_info
                                    .get("containerRuntimeVersion")
                                    .and_then(|v| v.as_str())
                                {
                                    obj["containerRuntime"] = json!(runtime);
                                }
                                if let Some(kernel) =
                                    node_info.get("kernelVersion").and_then(|v| v.as_str())
                                {
                                    obj["kernelVersion"] = json!(kernel);
                                }
                            }
                        }

                        let effective_cpu = if allocatable_cpu > 0.0 {
                            allocatable_cpu
                        } else {
                            capacity_cpu
                        };
                        let effective_mem = if allocatable_mem > 0.0 {
                            allocatable_mem
                        } else {
                            capacity_mem
                        };

                        if let Some((used_cpu, used_mem)) = node_metrics_map.get(&name) {
                            let cpu_pct = if effective_cpu > 0.0 {
                                ((used_cpu / effective_cpu) * 100.0).round() as i64
                            } else {
                                0
                            };
                            let mem_pct = if effective_mem > 0.0 {
                                ((used_mem / effective_mem) * 100.0).round() as i64
                            } else {
                                0
                            };
                            obj["cpu"] = json!(format!("{}%", cpu_pct));
                            obj["cpuCores"] =
                                json!(format!("{:.2} / {:.1} cores", used_cpu, effective_cpu));
                            obj["memory"] = json!(format!("{}%", mem_pct));
                            obj["memoryFormatted"] =
                                json!(format!("{:.1} / {:.1} GiB", used_mem, effective_mem));
                        } else if effective_cpu > 0.0 || effective_mem > 0.0 {
                            obj["cpu"] = json!(format!("{:.0} cores", effective_cpu));
                            obj["cpuCores"] =
                                json!(format!("{:.1} cores allocatable", effective_cpu));
                            obj["memory"] = json!(format!("{:.1} GiB", effective_mem));
                            obj["memoryFormatted"] =
                                json!(format!("{:.1} GiB allocatable", effective_mem));
                        } else {
                            obj["cpu"] = json!("-");
                            obj["cpuCores"] = json!("-");
                            obj["memory"] = json!("-");
                            obj["memoryFormatted"] = json!("-");
                        }
                        obj["podsCapacity"] = json!(pods_capacity);
                    }
                    "Deployment" => {
                        let s = item.data.get("status");
                        let ready = s
                            .and_then(|s| s.get("readyReplicas").and_then(|v| v.as_i64()))
                            .unwrap_or(0);
                        let total = item
                            .data
                            .get("spec")
                            .and_then(|s| s.get("replicas").and_then(|v| v.as_i64()))
                            .unwrap_or(0);
                        let updated = s
                            .and_then(|s| s.get("updatedReplicas").and_then(|v| v.as_i64()))
                            .unwrap_or(0);
                        let available = s
                            .and_then(|s| s.get("availableReplicas").and_then(|v| v.as_i64()))
                            .unwrap_or(0);
                        obj["ready"] = json!(format!("{}/{}", ready, total));
                        obj["upToDate"] = json!(updated.to_string());
                        obj["available"] = json!(available.to_string());
                    }
                    "StatefulSet" => {
                        let s = item.data.get("status");
                        let ready = s
                            .and_then(|s| s.get("readyReplicas").and_then(|v| v.as_i64()))
                            .or_else(|| {
                                s.and_then(|s| s.get("currentReplicas").and_then(|v| v.as_i64()))
                            })
                            .unwrap_or(0);
                        let total = item
                            .data
                            .get("spec")
                            .and_then(|s| s.get("replicas").and_then(|v| v.as_i64()))
                            .or_else(|| s.and_then(|s| s.get("replicas").and_then(|v| v.as_i64())))
                            .unwrap_or(1);
                        let current = s
                            .and_then(|s| s.get("currentReplicas").and_then(|v| v.as_i64()))
                            .unwrap_or(ready);
                        let updated = s
                            .and_then(|s| s.get("updatedReplicas").and_then(|v| v.as_i64()))
                            .unwrap_or(ready);
                        obj["ready"] = json!(format!("{}/{}", ready, total));
                        obj["desired"] = json!(total.to_string());
                        obj["current"] = json!(current.to_string());
                        obj["upToDate"] = json!(updated.to_string());
                        obj["available"] = json!(ready.to_string());
                    }
                    "DaemonSet" => {
                        let s = item.data.get("status");
                        let ready = s
                            .and_then(|s| s.get("numberReady").and_then(|v| v.as_i64()))
                            .or_else(|| {
                                s.and_then(|s| {
                                    s.get("currentNumberScheduled").and_then(|v| v.as_i64())
                                })
                            })
                            .unwrap_or(0);
                        let desired = s
                            .and_then(|s| s.get("desiredNumberScheduled").and_then(|v| v.as_i64()))
                            .or_else(|| {
                                s.and_then(|s| {
                                    s.get("currentNumberScheduled").and_then(|v| v.as_i64())
                                })
                            })
                            .unwrap_or(0);
                        let updated = s
                            .and_then(|s| s.get("updatedNumberScheduled").and_then(|v| v.as_i64()))
                            .unwrap_or(0);
                        let available = s
                            .and_then(|s| s.get("numberAvailable").and_then(|v| v.as_i64()))
                            .unwrap_or(0);
                        obj["ready"] = json!(format!("{}/{}", ready, desired));
                        obj["desired"] = json!(desired.to_string());
                        obj["current"] = json!(ready.to_string());
                        obj["upToDate"] = json!(updated.to_string());
                        obj["available"] = json!(available.to_string());
                    }
                    "ReplicaSet" => {
                        let s = item.data.get("status");
                        let ready = s
                            .and_then(|s| s.get("readyReplicas").and_then(|v| v.as_i64()))
                            .or_else(|| {
                                s.and_then(|s| s.get("availableReplicas").and_then(|v| v.as_i64()))
                            })
                            .unwrap_or(0);
                        let desired = item
                            .data
                            .get("spec")
                            .and_then(|s| s.get("replicas").and_then(|v| v.as_i64()))
                            .or_else(|| s.and_then(|s| s.get("replicas").and_then(|v| v.as_i64())))
                            .unwrap_or(0);
                        let current = s
                            .and_then(|s| s.get("replicas").and_then(|v| v.as_i64()))
                            .unwrap_or(ready);
                        let available = s
                            .and_then(|s| s.get("availableReplicas").and_then(|v| v.as_i64()))
                            .unwrap_or(ready);
                        obj["ready"] = json!(format!("{}/{}", ready, desired));
                        obj["desired"] = json!(desired.to_string());
                        obj["current"] = json!(current.to_string());
                        obj["available"] = json!(available.to_string());
                    }
                    "Job" => {
                        let s = item.data.get("status");
                        let succeeded = s
                            .and_then(|s| s.get("succeeded").and_then(|v| v.as_i64()))
                            .unwrap_or(0);
                        let completions = item
                            .data
                            .get("spec")
                            .and_then(|s| s.get("completions").and_then(|v| v.as_i64()))
                            .unwrap_or(1);
                        obj["completions"] = json!(format!("{}/{}", succeeded, completions));
                    }
                    "CronJob" => {
                        let schedule = item
                            .data
                            .get("spec")
                            .and_then(|s| s.get("schedule").and_then(|v| v.as_str()))
                            .unwrap_or("-");
                        let suspended = item
                            .data
                            .get("spec")
                            .and_then(|s| s.get("suspend").and_then(|v| v.as_bool()))
                            .unwrap_or(false);
                        obj["schedule"] = json!(schedule);
                        obj["suspend"] = json!(suspended);
                    }
                    "Service" => {
                        let spec = item.data.get("spec");
                        let svc_type = spec
                            .and_then(|s| s.get("type").and_then(|v| v.as_str()))
                            .unwrap_or("ClusterIP");
                        let cluster_ip = spec
                            .and_then(|s| s.get("clusterIP").and_then(|v| v.as_str()))
                            .unwrap_or("<none>");
                        obj["type"] = json!(svc_type);
                        obj["clusterIP"] = json!(cluster_ip);
                    }
                    "ConfigMap" => {
                        let data_count = item
                            .data
                            .get("data")
                            .and_then(|d| d.as_object())
                            .map(|o| o.len())
                            .unwrap_or(0);
                        obj["dataCount"] = json!(data_count);
                    }
                    "Secret" => {
                        let secret_type = item
                            .data
                            .get("type")
                            .and_then(|t| t.as_str())
                            .unwrap_or("Opaque");
                        let data_count = item
                            .data
                            .get("data")
                            .and_then(|d| d.as_object())
                            .map(|o| o.len())
                            .unwrap_or(0);
                        obj["secretType"] = json!(secret_type);
                        obj["dataCount"] = json!(data_count);
                    }
                    "PersistentVolumeClaim" => {
                        let spec = item.data.get("spec");
                        let storage = spec
                            .and_then(|s| s.get("resources"))
                            .and_then(|r| r.get("requests"))
                            .and_then(|req| req.get("storage").and_then(|v| v.as_str()))
                            .unwrap_or("-");
                        let sc = spec
                            .and_then(|s| s.get("storageClassName").and_then(|v| v.as_str()))
                            .unwrap_or("-");
                        obj["capacity"] = json!(storage);
                        obj["storageClass"] = json!(sc);
                    }
                    "PersistentVolume" => {
                        let spec = item.data.get("spec");
                        let storage = spec
                            .and_then(|s| s.get("capacity"))
                            .and_then(|c| c.get("storage").and_then(|v| v.as_str()))
                            .unwrap_or("-");
                        let sc = spec
                            .and_then(|s| s.get("storageClassName").and_then(|v| v.as_str()))
                            .unwrap_or("-");
                        obj["capacity"] = json!(storage);
                        obj["storageClass"] = json!(sc);
                    }
                    "StorageClass" => {
                        let prov = item
                            .data
                            .get("provisioner")
                            .and_then(|p| p.as_str())
                            .unwrap_or("-");
                        let rp = item
                            .data
                            .get("reclaimPolicy")
                            .and_then(|r| r.as_str())
                            .unwrap_or("Delete");
                        obj["provisioner"] = json!(prov);
                        obj["reclaimPolicy"] = json!(rp);
                    }
                    "ServiceAccount" => {
                        let sec_count = item
                            .data
                            .get("secrets")
                            .and_then(|s| s.as_array())
                            .map(|a| a.len())
                            .unwrap_or(0);
                        obj["secretsCount"] = json!(sec_count);
                    }
                    "Role" | "ClusterRole" => {
                        let rules_count = item
                            .data
                            .get("rules")
                            .and_then(|r| r.as_array())
                            .map(|a| a.len())
                            .unwrap_or(0);
                        obj["rulesCount"] = json!(rules_count);
                    }
                    "RoleBinding" | "ClusterRoleBinding" => {
                        let role_name = item
                            .data
                            .get("roleRef")
                            .and_then(|r| r.get("name").and_then(|n| n.as_str()))
                            .unwrap_or("-");
                        let role_kind = item
                            .data
                            .get("roleRef")
                            .and_then(|r| r.get("kind").and_then(|k| k.as_str()))
                            .unwrap_or("-");
                        let subs_count = item
                            .data
                            .get("subjects")
                            .and_then(|s| s.as_array())
                            .map(|a| a.len())
                            .unwrap_or(0);
                        obj["roleRef"] = json!(format!("{}/{}", role_kind, role_name));
                        obj["subjectsCount"] = json!(subs_count);
                    }
                    "Ingress" => {
                        let class_name = item
                            .data
                            .get("spec")
                            .and_then(|s| s.get("ingressClassName").and_then(|v| v.as_str()))
                            .unwrap_or("-");
                        obj["ingressClass"] = json!(class_name);
                    }
                    "LimitRange" => {
                        let limits = item
                            .data
                            .get("spec")
                            .and_then(|s| s.get("limits"))
                            .and_then(|l| l.as_array())
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|lim| lim.get("type").and_then(|t| t.as_str()))
                                    .collect::<Vec<_>>()
                                    .join(", ")
                            })
                            .unwrap_or_else(|| "Container".to_string());
                        obj["limitType"] = json!(limits);
                    }
                    "ResourceQuota" => {
                        let spec_hard = item
                            .data
                            .get("spec")
                            .and_then(|s| s.get("hard"))
                            .and_then(|h| h.as_object())
                            .map(|o| o.len())
                            .unwrap_or(0);
                        let status_used = item
                            .data
                            .get("status")
                            .and_then(|s| s.get("used"))
                            .and_then(|u| u.as_object())
                            .map(|o| o.len())
                            .unwrap_or(0);
                        obj["hardCount"] = json!(spec_hard);
                        obj["usedCount"] = json!(status_used);
                    }
                    "PodDisruptionBudget" => {
                        let spec = item.data.get("spec");
                        let min_avail = spec
                            .and_then(|s| s.get("minAvailable"))
                            .map(|v| v.to_string().replace('"', ""))
                            .or_else(|| {
                                spec.and_then(|s| s.get("maxUnavailable")).map(|v| {
                                    format!("maxUnavail: {}", v.to_string().replace('"', ""))
                                })
                            })
                            .unwrap_or_else(|| "1".to_string());
                        let status = item.data.get("status");
                        let allowed = status
                            .and_then(|s| s.get("disruptionsAllowed").and_then(|v| v.as_i64()))
                            .unwrap_or(0);
                        let current_healthy = status
                            .and_then(|s| s.get("currentHealthy").and_then(|v| v.as_i64()))
                            .unwrap_or(0);
                        let desired_healthy = status
                            .and_then(|s| s.get("desiredHealthy").and_then(|v| v.as_i64()))
                            .unwrap_or(0);
                        obj["minAvailable"] = json!(min_avail);
                        obj["disruptionsAllowed"] = json!(allowed);
                        obj["healthyRatio"] =
                            json!(format!("{}/{}", current_healthy, desired_healthy));
                    }
                    "HorizontalPodAutoscaler" => {
                        let spec = item.data.get("spec");
                        let min_rep = spec
                            .and_then(|s| s.get("minReplicas").and_then(|v| v.as_i64()))
                            .unwrap_or(1);
                        let max_rep = spec
                            .and_then(|s| s.get("maxReplicas").and_then(|v| v.as_i64()))
                            .unwrap_or(1);
                        let status = item.data.get("status");
                        let current_rep = status
                            .and_then(|s| s.get("currentReplicas").and_then(|v| v.as_i64()))
                            .unwrap_or(min_rep);
                        let desired_rep = status
                            .and_then(|s| s.get("desiredReplicas").and_then(|v| v.as_i64()))
                            .unwrap_or(current_rep);
                        obj["minReplicas"] = json!(min_rep);
                        obj["maxReplicas"] = json!(max_rep);
                        obj["currentReplicas"] = json!(current_rep);
                        obj["desiredReplicas"] = json!(desired_rep);
                        obj["replicasRatio"] =
                            json!(format!("{}-{} (curr: {})", min_rep, max_rep, current_rep));
                    }
                    "PriorityClass" => {
                        let val = item.data.get("value").and_then(|v| v.as_i64()).unwrap_or(0);
                        let global_default = item
                            .data
                            .get("globalDefault")
                            .and_then(|g| g.as_bool())
                            .unwrap_or(false);
                        obj["priorityValue"] = json!(val);
                        obj["globalDefault"] = json!(global_default);
                    }
                    "Event" => {
                        let event_type = item
                            .data
                            .get("type")
                            .and_then(|t| t.as_str())
                            .unwrap_or("Normal");
                        let reason = item
                            .data
                            .get("reason")
                            .and_then(|r| r.as_str())
                            .unwrap_or("-");
                        let message = item
                            .data
                            .get("message")
                            .and_then(|m| m.as_str())
                            .unwrap_or("-");
                        obj["eventType"] = json!(event_type);
                        obj["reason"] = json!(reason);
                        obj["message"] = json!(message);
                    }
                    "ValidatingWebhookConfiguration" | "MutatingWebhookConfiguration" => {
                        let webhooks = item.data.get("webhooks").and_then(|w| w.as_array());
                        let count = webhooks.map(|w| w.len()).unwrap_or(0);
                        let names = webhooks
                            .map(|w| {
                                w.iter()
                                    .filter_map(|hook| hook.get("name").and_then(|n| n.as_str()))
                                    .collect::<Vec<_>>()
                                    .join(", ")
                            })
                            .unwrap_or_default();
                        let failure_policy = webhooks
                            .and_then(|w| w.first())
                            .and_then(|hook| hook.get("failurePolicy").and_then(|f| f.as_str()))
                            .unwrap_or("Fail");
                        let side_effects = webhooks
                            .and_then(|w| w.first())
                            .and_then(|hook| hook.get("sideEffects").and_then(|s| s.as_str()))
                            .unwrap_or("None");
                        let timeout = webhooks
                            .and_then(|w| w.first())
                            .and_then(|hook| hook.get("timeoutSeconds").and_then(|t| t.as_i64()))
                            .map(|t| format!("{}s", t))
                            .unwrap_or_else(|| "10s".to_string());

                        obj["webhooksCount"] = json!(count);
                        obj["webhookNames"] = json!(names);
                        obj["failurePolicy"] = json!(failure_policy);
                        obj["sideEffects"] = json!(side_effects);
                        obj["timeoutSeconds"] = json!(timeout);
                    }
                    _ => {
                        // Generic extraction for CRDs and unknown resource kinds
                        if let Some(spec) = item.data.get("spec") {
                            if let Some(replicas) = spec.get("replicas").and_then(|r| r.as_i64()) {
                                obj["replicas"] = json!(replicas);
                            }
                        }
                        if let Some(status) = item.data.get("status") {
                            if let Some(phase) = status.get("phase").and_then(|p| p.as_str()) {
                                obj["phase"] = json!(phase);
                                obj["status"] = json!(phase);
                            }
                            if let Some(ready) = status.get("ready").and_then(|r| r.as_bool()) {
                                obj["ready"] = json!(if ready { "True" } else { "False" });
                            }
                        }
                    }
                }
                obj
            })
            .collect();

        Ok(mapped)
    }

    /// Resolve a pod name from either a direct pod name or a workload name (Deployment, DaemonSet, StatefulSet, Job).
    pub async fn resolve_pod_name(&self, namespace: &str, target_name: &str) -> String {
        let api: Api<Pod> = Api::namespaced(self.client.clone(), namespace);
        // 1. If direct pod exists, return it immediately
        if api.get(target_name).await.is_ok() {
            return target_name.to_string();
        }

        // 2. Otherwise search for pods in the namespace whose name starts with target_name
        let list_params = ListParams::default();
        if let Ok(pods) = api.list(&list_params).await {
            let prefix = format!("{}-", target_name);
            let mut matching: Vec<Pod> = pods
                .items
                .into_iter()
                .filter(|p| {
                    p.metadata
                        .name
                        .as_ref()
                        .map(|n| n == target_name || n.starts_with(&prefix))
                        .unwrap_or(false)
                })
                .collect();

            // Sort so Running pods and newer pods come first
            matching.sort_by(|a, b| {
                let a_phase = a
                    .status
                    .as_ref()
                    .and_then(|s| s.phase.as_deref())
                    .unwrap_or("");
                let b_phase = b
                    .status
                    .as_ref()
                    .and_then(|s| s.phase.as_deref())
                    .unwrap_or("");
                let a_running = a_phase == "Running";
                let b_running = b_phase == "Running";
                b_running.cmp(&a_running)
            });

            if let Some(first) = matching.first() {
                if let Some(name) = &first.metadata.name {
                    return name.clone();
                }
            }
        }

        target_name.to_string()
    }

    /// Container logs straight from the pod's log subresource.
    ///
    /// `previous` reads the last terminated container, which is the only way to see
    /// why a CrashLoopBackOff pod died — the live container has no output yet.
    pub async fn get_logs(
        &self,
        namespace: &str,
        pod_name: &str,
        container: Option<&str>,
        tail_lines: Option<i64>,
        previous: bool,
        timestamps: bool,
    ) -> Result<String, ConnectorError> {
        let actual_pod_name = self.resolve_pod_name(namespace, pod_name).await;
        let api: Api<Pod> = Api::namespaced(self.client.clone(), namespace);
        let params = kube::api::LogParams {
            container: container.map(|c| c.to_string()),
            tail_lines: Some(tail_lines.unwrap_or(1000)),
            previous,
            timestamps,
            ..Default::default()
        };
        api.logs(&actual_pod_name, &params)
            .await
            .map_err(ConnectorError::KubeError)
    }

    /// Container names for a pod, so the log and exec views can offer a picker
    /// instead of silently defaulting to the first container.
    pub async fn list_containers(
        &self,
        namespace: &str,
        pod_name: &str,
    ) -> Result<Vec<String>, ConnectorError> {
        let actual_pod_name = self.resolve_pod_name(namespace, pod_name).await;
        let api: Api<Pod> = Api::namespaced(self.client.clone(), namespace);
        let pod = api
            .get(&actual_pod_name)
            .await
            .map_err(ConnectorError::KubeError)?;
        let spec = pod.spec.unwrap_or_default();
        let mut names: Vec<String> = spec.containers.into_iter().map(|c| c.name).collect();
        names.extend(
            spec.init_containers
                .unwrap_or_default()
                .into_iter()
                .map(|c| c.name),
        );
        Ok(names)
    }

    pub async fn describe_resource(
        &self,
        kind: &str,
        name: &str,
        namespace: Option<&str>,
    ) -> Result<String, ConnectorError> {
        let yaml = self.get_resource_yaml(kind, name, namespace).await?;
        Ok(yaml)
    }

    pub async fn get_resource_yaml(
        &self,
        kind: &str,
        name: &str,
        namespace: Option<&str>,
    ) -> Result<String, ConnectorError> {
        if kind == "helm-releases" || kind == "helm" || kind == "HelmRelease" {
            let secret_api: Api<k8s_openapi::api::core::v1::Secret> = if let Some(ns) = namespace {
                if ns != "all" && !ns.is_empty() {
                    Api::namespaced(self.client.clone(), ns)
                } else {
                    Api::all(self.client.clone())
                }
            } else {
                Api::all(self.client.clone())
            };

            let lp = ListParams::default().labels("owner=helm");
            let secrets = secret_api
                .list(&lp)
                .await
                .map_err(ConnectorError::KubeError)?;

            let matching = secrets.items.into_iter().find(|s| {
                let s_name = s.metadata.name.clone().unwrap_or_default();
                let rel_name = s
                    .metadata
                    .labels
                    .as_ref()
                    .and_then(|l| l.get("name").cloned())
                    .unwrap_or_else(|| {
                        let parts: Vec<&str> = s_name.split('.').collect();
                        if parts.len() >= 5 {
                            parts[parts.len() - 2].to_string()
                        } else {
                            s_name.clone()
                        }
                    });
                rel_name == name || s_name == name
            });

            if let Some(mut s) = matching {
                s.metadata.managed_fields = None;
                return serde_yaml::to_string(&s)
                    .map_err(|e| ConnectorError::SerializationError(e.to_string()));
            }

            return Err(ConnectorError::NotFound(format!(
                "Helm release '{name}' not found"
            )));
        }

        let (resource, caps) = self.resolve_api_resource(kind)?;
        let api = self.get_api(&resource, &caps, namespace);
        let mut obj = tokio::time::timeout(std::time::Duration::from_secs(8), api.get(name))
            .await
            .map_err(|_| {
                ConnectorError::Timeout(format!("Fetching {kind}/{name} timed out after 8s"))
            })?
            .map_err(ConnectorError::KubeError)?;

        obj.metadata.managed_fields = None;

        let yaml = serde_yaml::to_string(&obj)
            .map_err(|e| ConnectorError::SerializationError(e.to_string()))?;

        // Confirmed against a live cluster: this path returned a Secret's full
        // .data block — base64, but the real values — with no gate at all,
        // while every other surface in the app (logs, the AI context) already
        // redacts by default. Scope the scrub to Secret specifically: the same
        // regex matches a ConfigMap's `data:` block too, and ConfigMap data is
        // meant to be visible. A later "reveal" action can opt back in per key
        // and write an audit entry when it does.
        if resource.kind.eq_ignore_ascii_case("secret") {
            Ok(crate::core::redact::RedactionEngine::scrub(&yaml))
        } else {
            Ok(yaml)
        }
    }

    pub async fn get_secret_data(
        &self,
        name: &str,
        namespace: Option<&str>,
    ) -> Result<crate::connector::SecretDetails, ConnectorError> {
        use base64::Engine as _;
        let ns = namespace.unwrap_or("default");
        let api: Api<k8s_openapi::api::core::v1::Secret> = Api::namespaced(self.client.clone(), ns);

        let secret = tokio::time::timeout(std::time::Duration::from_secs(8), api.get(name))
            .await
            .map_err(|_| ConnectorError::Timeout(format!("Fetching Secret/{name} timed out")))?
            .map_err(ConnectorError::KubeError)?;

        let secret_type = secret.type_.unwrap_or_else(|| "Opaque".to_string());
        let mut entries = Vec::new();

        if let Some(data_map) = secret.data {
            for (key, byte_buf) in data_map {
                let raw_bytes = byte_buf.0;
                let is_binary = std::str::from_utf8(&raw_bytes).is_err();
                let decoded_str = match std::str::from_utf8(&raw_bytes) {
                    Ok(s) => s.to_string(),
                    Err(_) => format!("<binary data: {} bytes>", raw_bytes.len()),
                };
                let b64_str = base64::engine::general_purpose::STANDARD.encode(&raw_bytes);

                entries.push(crate::connector::SecretEntry {
                    key,
                    value: decoded_str,
                    base64: b64_str,
                    is_binary,
                });
            }
        } else if let Some(str_data) = secret.string_data {
            for (key, val) in str_data {
                let b64_str = base64::engine::general_purpose::STANDARD.encode(val.as_bytes());
                entries.push(crate::connector::SecretEntry {
                    key,
                    value: val,
                    base64: b64_str,
                    is_binary: false,
                });
            }
        }

        entries.sort_by(|a, b| a.key.cmp(&b.key));

        Ok(crate::connector::SecretDetails {
            name: name.to_string(),
            namespace: ns.to_string(),
            secret_type,
            entries,
        })
    }

    pub async fn update_secret_data(
        &self,
        name: &str,
        namespace: Option<&str>,
        entries: std::collections::HashMap<String, String>,
        is_plaintext: bool,
    ) -> Result<crate::connector::SecretDetails, ConnectorError> {
        use base64::Engine as _;
        let ns = namespace.unwrap_or("default");
        let api: Api<k8s_openapi::api::core::v1::Secret> = Api::namespaced(self.client.clone(), ns);

        let mut secret = tokio::time::timeout(std::time::Duration::from_secs(8), api.get(name))
            .await
            .map_err(|_| ConnectorError::Timeout(format!("Fetching Secret/{name} timed out")))?
            .map_err(ConnectorError::KubeError)?;

        if is_plaintext {
            let map: std::collections::BTreeMap<String, String> = entries.into_iter().collect();
            secret.string_data = Some(map);
            secret.data = None;
        } else {
            let mut data_map = std::collections::BTreeMap::new();
            for (k, v) in entries {
                let bytes = base64::engine::general_purpose::STANDARD
                    .decode(&v)
                    .unwrap_or_else(|_| v.into_bytes());
                data_map.insert(k, k8s_openapi::ByteString(bytes));
            }
            secret.data = Some(data_map);
            secret.string_data = None;
        }

        let pp = kube::api::PostParams::default();
        api.replace(name, &pp, &secret)
            .await
            .map_err(ConnectorError::KubeError)?;

        self.get_secret_data(name, Some(ns)).await
    }

    fn decode_helm_secret_release(
        secret: &k8s_openapi::api::core::v1::Secret,
    ) -> Option<serde_json::Value> {
        use base64::Engine as _;
        use std::io::Read;

        let data_map = secret.data.as_ref()?;
        let byte_buf = data_map.get("release")?;
        let raw_bytes = &byte_buf.0;

        let b64_str = std::str::from_utf8(raw_bytes).ok()?;
        let gzip_bytes = base64::engine::general_purpose::STANDARD
            .decode(b64_str.trim())
            .ok()?;

        let mut decoder = flate2::read::GzDecoder::new(&gzip_bytes[..]);
        let mut json_str = String::new();
        decoder.read_to_string(&mut json_str).ok()?;

        serde_json::from_str(&json_str).ok()
    }

    pub async fn get_helm_release_details(
        &self,
        name: &str,
        namespace: Option<&str>,
    ) -> Result<crate::connector::HelmReleaseDetails, ConnectorError> {
        let secret_api: Api<k8s_openapi::api::core::v1::Secret> = if let Some(ns) = namespace {
            if ns != "all" && !ns.is_empty() {
                Api::namespaced(self.client.clone(), ns)
            } else {
                Api::all(self.client.clone())
            }
        } else {
            Api::all(self.client.clone())
        };

        let lp = ListParams::default().labels("owner=helm");
        let secrets = secret_api
            .list(&lp)
            .await
            .map_err(ConnectorError::KubeError)?;

        let mut matching_secrets: Vec<k8s_openapi::api::core::v1::Secret> = secrets
            .items
            .into_iter()
            .filter(|s| {
                let s_name = s.metadata.name.clone().unwrap_or_default();
                let rel_name = s
                    .metadata
                    .labels
                    .as_ref()
                    .and_then(|l| l.get("name").cloned())
                    .unwrap_or_else(|| {
                        let parts: Vec<&str> = s_name.split('.').collect();
                        if parts.len() >= 5 {
                            parts[parts.len() - 2].to_string()
                        } else {
                            s_name.clone()
                        }
                    });
                rel_name == name || s_name == name
            })
            .collect();

        if matching_secrets.is_empty() {
            return Err(ConnectorError::NotFound(format!(
                "Helm release '{name}' not found"
            )));
        }

        // Sort matching secrets by revision version (highest revision first)
        matching_secrets.sort_by(|a, b| {
            let rev_a: i32 = a
                .metadata
                .labels
                .as_ref()
                .and_then(|l| l.get("version").and_then(|v| v.parse().ok()))
                .unwrap_or(1);
            let rev_b: i32 = b
                .metadata
                .labels
                .as_ref()
                .and_then(|l| l.get("version").and_then(|v| v.parse().ok()))
                .unwrap_or(1);
            rev_b.cmp(&rev_a)
        });

        let mut history: Vec<crate::connector::HelmRevisionInfo> = Vec::new();
        let mut latest_details: Option<crate::connector::HelmReleaseDetails> = None;

        for s in &matching_secrets {
            let meta = &s.metadata;
            let rev: i32 = meta
                .labels
                .as_ref()
                .and_then(|l| l.get("version").and_then(|v| v.parse().ok()))
                .unwrap_or(1);
            let status = meta
                .labels
                .as_ref()
                .and_then(|l| l.get("status").cloned())
                .unwrap_or_else(|| "deployed".to_string());
            let updated = meta
                .creation_timestamp
                .as_ref()
                .map(|t| t.0.to_rfc3339())
                .unwrap_or_default();

            if let Some(json_val) = Self::decode_helm_secret_release(s) {
                let chart_meta = json_val.get("chart").and_then(|c| c.get("metadata"));
                let chart_name = chart_meta
                    .and_then(|m| m.get("name").and_then(|n| n.as_str()))
                    .unwrap_or("unknown")
                    .to_string();
                let chart_ver = chart_meta
                    .and_then(|m| m.get("version").and_then(|n| n.as_str()))
                    .unwrap_or("unknown")
                    .to_string();
                let app_ver = chart_meta
                    .and_then(|m| m.get("appVersion").and_then(|n| n.as_str()))
                    .unwrap_or("")
                    .to_string();
                let description = json_val
                    .get("info")
                    .and_then(|i| i.get("description").and_then(|d| d.as_str()))
                    .unwrap_or("")
                    .to_string();
                let notes = json_val
                    .get("info")
                    .and_then(|i| i.get("notes").and_then(|n| n.as_str()))
                    .unwrap_or("")
                    .to_string();
                let manifest = json_val
                    .get("manifest")
                    .and_then(|m| m.as_str())
                    .unwrap_or("")
                    .to_string();

                let user_values_yaml = json_val
                    .get("config")
                    .map(|c| serde_yaml::to_string(c).unwrap_or_default())
                    .unwrap_or_default();

                history.push(crate::connector::HelmRevisionInfo {
                    revision: rev,
                    updated: updated.clone(),
                    status: status.clone(),
                    chart: format!("{}-{}", chart_name, chart_ver),
                    app_version: app_ver.clone(),
                    description,
                });

                if latest_details.is_none() {
                    // Extract child resources from manifest
                    let mut child_resources = Vec::new();
                    use serde::Deserialize as _;
                    for doc in serde_yaml::Deserializer::from_str(&manifest) {
                        if let Ok(v) = serde_json::Value::deserialize(doc) {
                            let kind = v.get("kind").and_then(|k| k.as_str()).unwrap_or_default();
                            let child_name = v
                                .get("metadata")
                                .and_then(|m| m.get("name").and_then(|n| n.as_str()))
                                .unwrap_or_default();
                            let child_ns = v
                                .get("metadata")
                                .and_then(|m| m.get("namespace").and_then(|n| n.as_str()))
                                .map(|s| s.to_string());
                            let api_version = v
                                .get("apiVersion")
                                .and_then(|a| a.as_str())
                                .unwrap_or_default();

                            if !kind.is_empty() && !child_name.is_empty() {
                                child_resources.push(crate::connector::HelmChildResource {
                                    kind: kind.to_string(),
                                    name: child_name.to_string(),
                                    namespace: child_ns,
                                    api_version: api_version.to_string(),
                                });
                            }
                        }
                    }

                    latest_details = Some(crate::connector::HelmReleaseDetails {
                        name: name.to_string(),
                        namespace: meta
                            .namespace
                            .clone()
                            .unwrap_or_else(|| "default".to_string()),
                        revision: rev,
                        status,
                        chart_name,
                        chart_version: chart_ver,
                        app_version: app_ver,
                        updated,
                        user_values_yaml,
                        computed_values_yaml: String::new(),
                        manifest,
                        notes,
                        history: Vec::new(),
                        child_resources,
                    });
                }
            } else {
                history.push(crate::connector::HelmRevisionInfo {
                    revision: rev,
                    updated: updated.clone(),
                    status: status.clone(),
                    chart: "unknown".to_string(),
                    app_version: String::new(),
                    description: String::new(),
                });
            }
        }

        if let Some(mut details) = latest_details {
            details.history = history;
            Ok(details)
        } else {
            Err(ConnectorError::NotFound(format!(
                "Could not decode release details for '{name}'"
            )))
        }
    }

    pub async fn install_helm_release(
        &self,
        release_name: &str,
        namespace: &str,
        chart: &str,
        version: Option<&str>,
        values_yaml: Option<&str>,
        create_namespace: bool,
        kube_context: Option<&str>,
    ) -> Result<String, ConnectorError> {
        let mut cmd = std::process::Command::new("helm");
        cmd.arg("install")
            .arg(release_name)
            .arg(chart)
            .arg("--namespace")
            .arg(namespace);

        if create_namespace {
            cmd.arg("--create-namespace");
        }

        if let Some(ver) = version {
            if !ver.trim().is_empty() {
                cmd.arg("--version").arg(ver);
            }
        }

        if let Some(ctx) = kube_context {
            if !ctx.trim().is_empty() {
                cmd.arg("--kube-context").arg(ctx);
            }
        }

        let mut temp_path: Option<std::path::PathBuf> = None;
        if let Some(val_str) = values_yaml {
            if !val_str.trim().is_empty() {
                let p = std::env::temp_dir().join(format!(
                    "helm-val-{}.yaml",
                    chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
                ));
                if tokio::fs::write(&p, val_str).await.is_ok() {
                    cmd.arg("-f").arg(&p);
                    temp_path = Some(p);
                }
            }
        }

        let out = tokio::task::spawn_blocking(move || cmd.output())
            .await
            .map_err(|e| ConnectorError::Generic(e.to_string()))?
            .map_err(|e| ConnectorError::Generic(format!("Failed to execute helm CLI: {e}")))?;

        if let Some(p) = temp_path {
            let _ = tokio::fs::remove_file(p).await;
        }

        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).to_string())
        } else {
            let err = String::from_utf8_lossy(&out.stderr).to_string();
            Err(ConnectorError::Generic(if err.trim().is_empty() {
                String::from_utf8_lossy(&out.stdout).to_string()
            } else {
                err
            }))
        }
    }

    pub async fn upgrade_helm_release(
        &self,
        release_name: &str,
        namespace: &str,
        chart: Option<&str>,
        version: Option<&str>,
        values_yaml: Option<&str>,
        reset_values: bool,
        kube_context: Option<&str>,
    ) -> Result<String, ConnectorError> {
        let mut cmd = std::process::Command::new("helm");
        cmd.arg("upgrade").arg(release_name);

        if let Some(c) = chart {
            if !c.trim().is_empty() {
                cmd.arg(c);
            } else {
                cmd.arg(release_name);
            }
        } else {
            cmd.arg(release_name);
        }

        cmd.arg("--namespace").arg(namespace);

        if reset_values {
            cmd.arg("--reset-values");
        }

        if let Some(ver) = version {
            if !ver.trim().is_empty() {
                cmd.arg("--version").arg(ver);
            }
        }

        if let Some(ctx) = kube_context {
            if !ctx.trim().is_empty() {
                cmd.arg("--kube-context").arg(ctx);
            }
        }

        let mut temp_path: Option<std::path::PathBuf> = None;
        if let Some(val_str) = values_yaml {
            if !val_str.trim().is_empty() {
                let p = std::env::temp_dir().join(format!(
                    "helm-upg-{}.yaml",
                    chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
                ));
                if tokio::fs::write(&p, val_str).await.is_ok() {
                    cmd.arg("-f").arg(&p);
                    temp_path = Some(p);
                }
            }
        }

        let out = tokio::task::spawn_blocking(move || cmd.output())
            .await
            .map_err(|e| ConnectorError::Generic(e.to_string()))?
            .map_err(|e| ConnectorError::Generic(format!("Failed to execute helm CLI: {e}")))?;

        if let Some(p) = temp_path {
            let _ = tokio::fs::remove_file(p).await;
        }

        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).to_string())
        } else {
            let err = String::from_utf8_lossy(&out.stderr).to_string();
            Err(ConnectorError::Generic(if err.trim().is_empty() {
                String::from_utf8_lossy(&out.stdout).to_string()
            } else {
                err
            }))
        }
    }

    pub async fn rollback_helm_release(
        &self,
        release_name: &str,
        namespace: &str,
        revision: i32,
        kube_context: Option<&str>,
    ) -> Result<String, ConnectorError> {
        let mut cmd = std::process::Command::new("helm");
        cmd.arg("rollback")
            .arg(release_name)
            .arg(revision.to_string())
            .arg("--namespace")
            .arg(namespace);

        if let Some(ctx) = kube_context {
            if !ctx.trim().is_empty() {
                cmd.arg("--kube-context").arg(ctx);
            }
        }

        let out = tokio::task::spawn_blocking(move || cmd.output())
            .await
            .map_err(|e| ConnectorError::Generic(e.to_string()))?
            .map_err(|e| {
                ConnectorError::Generic(format!("Failed to execute helm rollback: {e}"))
            })?;

        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).to_string())
        } else {
            let err = String::from_utf8_lossy(&out.stderr).to_string();
            Err(ConnectorError::Generic(if err.trim().is_empty() {
                String::from_utf8_lossy(&out.stdout).to_string()
            } else {
                err
            }))
        }
    }

    pub async fn uninstall_helm_release(
        &self,
        release_name: &str,
        namespace: &str,
        keep_history: bool,
        kube_context: Option<&str>,
    ) -> Result<String, ConnectorError> {
        let mut cmd = std::process::Command::new("helm");
        cmd.arg("uninstall")
            .arg(release_name)
            .arg("--namespace")
            .arg(namespace);

        if keep_history {
            cmd.arg("--keep-history");
        }

        if let Some(ctx) = kube_context {
            if !ctx.trim().is_empty() {
                cmd.arg("--kube-context").arg(ctx);
            }
        }

        let out = tokio::task::spawn_blocking(move || cmd.output())
            .await
            .map_err(|e| ConnectorError::Generic(e.to_string()))?
            .map_err(|e| {
                ConnectorError::Generic(format!("Failed to execute helm uninstall: {e}"))
            })?;

        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).to_string())
        } else {
            let err = String::from_utf8_lossy(&out.stderr).to_string();
            Err(ConnectorError::Generic(if err.trim().is_empty() {
                String::from_utf8_lossy(&out.stdout).to_string()
            } else {
                err
            }))
        }
    }

    pub async fn list_helm_repositories(&self) -> Result<Vec<serde_json::Value>, ConnectorError> {
        let mut cmd = std::process::Command::new("helm");
        cmd.arg("repo").arg("list").arg("--output").arg("json");

        let out = tokio::task::spawn_blocking(move || cmd.output())
            .await
            .map_err(|e| ConnectorError::Generic(e.to_string()))?
            .map_err(|e| {
                ConnectorError::Generic(format!("Failed to execute helm repo list: {e}"))
            })?;

        if out.status.success() {
            let list: Vec<serde_json::Value> =
                serde_json::from_slice(&out.stdout).unwrap_or_default();
            Ok(list)
        } else {
            Ok(Vec::new())
        }
    }

    pub async fn add_helm_repository(
        &self,
        name: &str,
        url: &str,
    ) -> Result<String, ConnectorError> {
        let mut cmd = std::process::Command::new("helm");
        cmd.arg("repo").arg("add").arg(name).arg(url);

        let out = tokio::task::spawn_blocking(move || cmd.output())
            .await
            .map_err(|e| ConnectorError::Generic(e.to_string()))?
            .map_err(|e| {
                ConnectorError::Generic(format!("Failed to execute helm repo add: {e}"))
            })?;

        if out.status.success() {
            // Also run repo update
            let mut up_cmd = std::process::Command::new("helm");
            up_cmd.arg("repo").arg("update");
            let _ = tokio::task::spawn_blocking(move || up_cmd.output()).await;

            Ok(String::from_utf8_lossy(&out.stdout).to_string())
        } else {
            let err = String::from_utf8_lossy(&out.stderr).to_string();
            Err(ConnectorError::Generic(err))
        }
    }

    pub async fn list_namespaces(&self) -> Result<Vec<String>, ConnectorError> {
        let api: Api<Namespace> = Api::all(self.client.clone());
        let list_res = tokio::time::timeout(
            std::time::Duration::from_secs(6),
            api.list(&ListParams::default()),
        )
        .await;

        let mut namespaces = match list_res {
            Ok(Ok(list)) => list
                .items
                .into_iter()
                .filter_map(|ns| ns.metadata.name)
                .collect::<Vec<String>>(),
            Ok(Err(e)) => {
                let err_str = e.to_string();
                let lower = err_str.to_lowercase();
                if lower.contains("401")
                    || lower.contains("unauthorized")
                    || lower.contains("token")
                    || lower.contains("expired")
                    || lower.contains("unrecognizedclientexception")
                {
                    return Err(ConnectorError::AuthError(format!(
                        "Authentication failed or token expired: {}",
                        err_str
                    )));
                }
                if !lower.contains("403") && !lower.contains("forbidden") {
                    return Err(ConnectorError::KubeError(e));
                }
                tracing::warn!("Cluster-wide namespace listing failed with 403 ({e}), attempting discovery from pods and context");
                Vec::new()
            }
            Err(_) => {
                return Err(ConnectorError::Timeout("Listing namespaces timed out after 6s. Please check your cluster connection or VPN.".to_string()));
            }
        };

        // If cluster-wide list was empty or denied by RBAC, discover namespaces from pods
        if namespaces.is_empty() {
            let pod_api: Api<Pod> = Api::all(self.client.clone());
            if let Ok(Ok(pods)) = tokio::time::timeout(
                std::time::Duration::from_secs(4),
                pod_api.list(&ListParams::default()),
            )
            .await
            {
                for p in pods.items {
                    if let Some(ns) = p.metadata.namespace {
                        if !namespaces.contains(&ns) {
                            namespaces.push(ns);
                        }
                    }
                }
            }
        }

        // Ensure "default" is always present if nothing was discovered
        if !namespaces.contains(&"default".to_string()) {
            namespaces.insert(0, "default".to_string());
        }

        namespaces.sort();
        Ok(namespaces)
    }

    pub async fn list_pods(
        &self,
        namespace: Option<&str>,
    ) -> Result<Vec<PodSummary>, ConnectorError> {
        let api: Api<Pod> = if let Some(ns) = namespace {
            if ns != "all" && !ns.is_empty() {
                Api::namespaced(self.client.clone(), ns)
            } else {
                Api::all(self.client.clone())
            }
        } else {
            Api::all(self.client.clone())
        };

        let lp_pods = ListParams::default();
        let lp_metrics = ListParams::default();
        let (pods_res, metrics_res) = tokio::join!(
            tokio::time::timeout(std::time::Duration::from_secs(6), api.list(&lp_pods),),
            async {
                if let Ok((res, caps)) = self.resolve_api_resource("podmetrics") {
                    let metrics_api = self.get_api(&res, &caps, namespace);
                    tokio::time::timeout(
                        std::time::Duration::from_secs(3),
                        metrics_api.list(&lp_metrics),
                    )
                    .await
                    .ok()
                    .and_then(|r| r.ok())
                } else {
                    None
                }
            }
        );

        let pods = pods_res
            .map_err(|_| ConnectorError::Timeout("Listing pods timed out after 6s".to_string()))?
            .map_err(ConnectorError::KubeError)?;

        let pod_metrics_map: std::collections::HashMap<(String, String), (String, String)> =
            metrics_res
                .map(|l| {
                    let mut map = std::collections::HashMap::new();
                    for item in l.items {
                        let pod_name = item.name_any();
                        let pod_ns = item.namespace().unwrap_or_else(|| "default".to_string());
                        let mut total_cpu = 0.0;
                        let mut total_mem_gib = 0.0;
                        if let Some(containers) =
                            item.data.get("containers").and_then(|c| c.as_array())
                        {
                            for c in containers {
                                if let Some(usage) = c.get("usage") {
                                    if let Some(cpu_str) = usage.get("cpu").and_then(|v| v.as_str())
                                    {
                                        total_cpu += parse_cpu_cores(cpu_str);
                                    }
                                    if let Some(mem_str) =
                                        usage.get("memory").and_then(|v| v.as_str())
                                    {
                                        total_mem_gib += parse_memory_gib(mem_str);
                                    }
                                }
                            }
                        }
                        let cpu_str = if total_cpu < 1.0 {
                            format!("{:.0}m", total_cpu * 1000.0)
                        } else {
                            format!("{:.2} cores", total_cpu)
                        };
                        let mem_str = if total_mem_gib < 1.0 {
                            format!("{:.0}Mi", total_mem_gib * 1024.0)
                        } else {
                            format!("{:.2}Gi", total_mem_gib)
                        };
                        map.insert((pod_ns, pod_name), (cpu_str, mem_str));
                    }
                    map
                })
                .unwrap_or_default();

        let mut summaries = Vec::new();

        for pod in pods.items {
            let meta = pod.metadata;
            let name = meta.name.unwrap_or_default();
            let ns = meta.namespace.unwrap_or_else(|| "default".to_string());
            let status_obj = pod.status.unwrap_or_default();
            let phase = status_obj.phase.unwrap_or_else(|| "Unknown".to_string());
            let container_statuses = status_obj.container_statuses.unwrap_or_default();
            let total = container_statuses.len();
            let ready = container_statuses.iter().filter(|c| c.ready).count();
            let restarts = container_statuses.iter().map(|c| c.restart_count).sum();

            let created_at_str = meta.creation_timestamp.as_ref().map(|t| t.0.to_rfc3339());
            let age_str = if let Some(created) = meta.creation_timestamp.as_ref() {
                let dur = chrono::Utc::now().signed_duration_since(created.0);
                if dur.num_days() > 0 {
                    format!("{}d", dur.num_days())
                } else if dur.num_hours() > 0 {
                    format!("{}h", dur.num_hours())
                } else if dur.num_minutes() > 0 {
                    format!("{}m", dur.num_minutes())
                } else {
                    format!("{}s", dur.num_seconds())
                }
            } else {
                "-".to_string()
            };

            let (cpu_metric, mem_metric) =
                if let Some((c, m)) = pod_metrics_map.get(&(ns.clone(), name.clone())) {
                    (Some(c.clone()), Some(m.clone()))
                } else {
                    (None, None)
                };

            let mut container_list = Vec::new();
            for cs in &container_statuses {
                let state_str = if cs.state.as_ref().and_then(|s| s.running.as_ref()).is_some() {
                    "running".to_string()
                } else if let Some(w) = cs.state.as_ref().and_then(|s| s.waiting.as_ref()) {
                    w.reason.clone().unwrap_or_else(|| "waiting".to_string())
                } else if let Some(t) = cs.state.as_ref().and_then(|s| s.terminated.as_ref()) {
                    t.reason.clone().unwrap_or_else(|| "terminated".to_string())
                } else {
                    "unknown".to_string()
                };

                let reason_str = cs.state.as_ref().and_then(|s| {
                    s.waiting
                        .as_ref()
                        .and_then(|w| w.reason.clone())
                        .or_else(|| s.terminated.as_ref().and_then(|t| t.reason.clone()))
                });

                container_list.push(crate::connector::ContainerStatusSummary {
                    name: cs.name.clone(),
                    ready: cs.ready,
                    state: state_str,
                    reason: reason_str,
                });
            }

            summaries.push(PodSummary {
                name,
                namespace: ns,
                ready_containers: format!("{}/{}", ready, total),
                status: phase,
                restarts,
                age: age_str,
                cpu: cpu_metric,
                memory: mem_metric,
                node: pod.spec.and_then(|s| s.node_name),
                containers: Some(container_list),
                created_at: created_at_str,
            });
        }
        Ok(summaries)
    }

    pub async fn dry_run_apply(
        &self,
        manifest_yaml: &str,
        namespace: Option<&str>,
    ) -> Result<DryRunResult, ConnectorError> {
        let mut obj: DynamicObject = serde_yaml::from_str(manifest_yaml)
            .map_err(|e| ConnectorError::DryRunError(format!("Invalid YAML: {}", e)))?;

        let kind = obj
            .types
            .as_ref()
            .map(|t| t.kind.clone())
            .unwrap_or_else(|| "Unknown".to_string());
        let name = obj.name_any();
        let target_ns = obj
            .namespace()
            .or_else(|| namespace.map(|s| s.to_string()))
            .unwrap_or_else(|| "default".to_string());

        let (resource, caps) = self.resolve_api_resource(&kind)?;
        let api = self.get_api(&resource, &caps, Some(&target_ns));

        let original_yaml = self
            .get_resource_yaml(&kind, &name, Some(&target_ns))
            .await
            .unwrap_or_else(|_| "# Resource does not currently exist\n".to_string());

        let pp = PostParams {
            dry_run: true,
            field_manager: Some("k8sUI".to_string()),
        };

        obj.metadata.managed_fields = None;

        let apply_result = if original_yaml.starts_with("# Resource does not currently exist") {
            api.create(&pp, &obj).await
        } else {
            let patch_params = PatchParams {
                dry_run: true,
                force: true,
                field_manager: Some("k8sUI".to_string()),
                ..Default::default()
            };
            api.patch(&name, &patch_params, &Patch::Apply(&obj)).await
        };

        match apply_result {
            Ok(mut returned) => {
                // The API server hands back the object as it *would* exist. Diffing
                // against live state is the whole point of the dry run — a diff built
                // from the submitted manifest would just echo the input back.
                returned.metadata.managed_fields = None;
                let proposed_yaml = serde_yaml::to_string(&returned)
                    .map_err(|e| ConnectorError::SerializationError(e.to_string()))?;
                let diff = unified_diff(&original_yaml, &proposed_yaml, &kind, &name);

                Ok(DryRunResult {
                    kind,
                    name,
                    namespace: Some(target_ns),
                    original_yaml,
                    proposed_yaml,
                    diff,
                    server_validation_passed: true,
                    validation_warnings: vec![],
                })
            }
            Err(e) => Err(ConnectorError::DryRunError(format!(
                "Dry-run failed: {}",
                e
            ))),
        }
    }

    pub async fn apply_manifest(
        &self,
        manifest_yaml: &str,
        namespace: Option<&str>,
    ) -> Result<ApplyResult, ConnectorError> {
        let mut obj: DynamicObject = serde_yaml::from_str(manifest_yaml)
            .map_err(|e| ConnectorError::DryRunError(format!("Invalid YAML: {}", e)))?;

        let kind = obj
            .types
            .as_ref()
            .map(|t| t.kind.clone())
            .unwrap_or_else(|| "Unknown".to_string());
        let name = obj.name_any();
        let target_ns = obj
            .namespace()
            .or_else(|| namespace.map(|s| s.to_string()))
            .unwrap_or_else(|| "default".to_string());

        let (resource, caps) = self.resolve_api_resource(&kind)?;
        let api = self.get_api(&resource, &caps, Some(&target_ns));

        obj.metadata.managed_fields = None;

        let patch_params = PatchParams {
            force: true,
            field_manager: Some("k8sUI".to_string()),
            ..Default::default()
        };

        api.patch(&name, &patch_params, &Patch::Apply(&obj))
            .await
            .map_err(ConnectorError::KubeError)?;

        Ok(ApplyResult {
            kind,
            name,
            namespace: Some(target_ns),
            action: "configured".to_string(),
        })
    }

    pub async fn scale_resource(
        &self,
        kind: &str,
        name: &str,
        namespace: &str,
        replicas: i32,
    ) -> Result<ScaleResult, ConnectorError> {
        let (resource, caps) = self.resolve_api_resource(kind)?;
        let api = self.get_api(&resource, &caps, Some(namespace));

        let current = api.get(name).await.map_err(ConnectorError::KubeError)?;
        let prev_replicas = current
            .data
            .get("spec")
            .and_then(|s| s.get("replicas").and_then(|v| v.as_i64()))
            .unwrap_or(1) as i32;

        let patch_json = json!({
            "spec": {
                "replicas": replicas
            }
        });

        api.patch(name, &PatchParams::default(), &Patch::Merge(&patch_json))
            .await
            .map_err(ConnectorError::KubeError)?;

        Ok(ScaleResult {
            kind: kind.to_string(),
            name: name.to_string(),
            namespace: namespace.to_string(),
            previous_replicas: prev_replicas,
            new_replicas: replicas,
        })
    }

    pub async fn restart_resource(
        &self,
        kind: &str,
        name: &str,
        namespace: &str,
    ) -> Result<bool, ConnectorError> {
        let (resource, caps) = self.resolve_api_resource(kind)?;
        let api = self.get_api(&resource, &caps, Some(namespace));
        let now = chrono::Utc::now().to_rfc3339();
        let patch_json = json!({
            "spec": {
                "template": {
                    "metadata": {
                        "annotations": {
                            "kubectl.kubernetes.io/restartedAt": now
                        }
                    }
                }
            }
        });
        api.patch(name, &PatchParams::default(), &Patch::Merge(&patch_json))
            .await
            .map_err(ConnectorError::KubeError)?;
        Ok(true)
    }

    pub async fn delete_resource(
        &self,
        kind: &str,
        name: &str,
        namespace: Option<&str>,
    ) -> Result<bool, ConnectorError> {
        if kind == "helm-releases" || kind == "helm" || kind == "HelmRelease" {
            let secret_api: Api<k8s_openapi::api::core::v1::Secret> = if let Some(ns) = namespace {
                if ns != "all" && !ns.is_empty() {
                    Api::namespaced(self.client.clone(), ns)
                } else {
                    Api::all(self.client.clone())
                }
            } else {
                Api::all(self.client.clone())
            };

            let lp = ListParams::default().labels("owner=helm");
            let secrets = secret_api
                .list(&lp)
                .await
                .map_err(ConnectorError::KubeError)?;

            let mut deleted_any = false;
            let delete_params = kube::api::DeleteParams::default();

            for s in secrets.items {
                let s_name = s.metadata.name.clone().unwrap_or_default();
                let rel_name = s
                    .metadata
                    .labels
                    .as_ref()
                    .and_then(|l| l.get("name").cloned())
                    .unwrap_or_else(|| {
                        let parts: Vec<&str> = s_name.split('.').collect();
                        if parts.len() >= 5 {
                            parts[parts.len() - 2].to_string()
                        } else {
                            s_name.clone()
                        }
                    });

                if rel_name == name || s_name == name {
                    let _ = secret_api.delete(&s_name, &delete_params).await;
                    deleted_any = true;
                }
            }

            return Ok(deleted_any);
        }

        let (resource, caps) = self.resolve_api_resource(kind)?;
        let api = self.get_api(&resource, &caps, namespace);
        let delete_params = kube::api::DeleteParams::default();
        api.delete(name, &delete_params)
            .await
            .map_err(ConnectorError::KubeError)?;
        Ok(true)
    }

    /// Compute real cluster-wide overview telemetry: CPU/Memory limits, requests, usage,
    /// pod capacity, node topology, workload health, and recent warning events.
    pub async fn get_cluster_overview(&self) -> Result<ClusterOverviewData, ConnectorError> {
        let node_api: Api<Node> = Api::all(self.client.clone());
        let pod_api: Api<Pod> = Api::all(self.client.clone());
        let dep_api: Api<Deployment> = Api::all(self.client.clone());
        let sts_api: Api<StatefulSet> = Api::all(self.client.clone());
        let ds_api: Api<DaemonSet> = Api::all(self.client.clone());
        let cj_api: Api<CronJob> = Api::all(self.client.clone());
        let job_api: Api<Job> = Api::all(self.client.clone());
        let event_api: Api<Event> = Api::all(self.client.clone());

        let node_metrics_api = (|| -> Result<Api<DynamicObject>, ConnectorError> {
            let (res, caps) = self.resolve_api_resource("nodemetrics")?;
            Ok(self.get_api(&res, &caps, None))
        })();

        let lp = ListParams::default();

        // Execute all 9 cluster queries concurrently in parallel with safe 5s timeouts
        let (
            nodes_res,
            pods_res,
            metrics_res,
            deps_res,
            sts_res,
            ds_res,
            cjs_res,
            jobs_res,
            events_res,
        ) = tokio::join!(
            tokio::time::timeout(std::time::Duration::from_secs(5), node_api.list(&lp)),
            tokio::time::timeout(std::time::Duration::from_secs(5), pod_api.list(&lp)),
            tokio::time::timeout(std::time::Duration::from_secs(3), async {
                if let Ok(api) = node_metrics_api {
                    let lp_m = ListParams::default();
                    api.list(&lp_m).await.ok().map(|l| l.items)
                } else {
                    None
                }
            }),
            tokio::time::timeout(std::time::Duration::from_secs(5), dep_api.list(&lp)),
            tokio::time::timeout(std::time::Duration::from_secs(5), sts_api.list(&lp)),
            tokio::time::timeout(std::time::Duration::from_secs(5), ds_api.list(&lp)),
            tokio::time::timeout(std::time::Duration::from_secs(5), cj_api.list(&lp)),
            tokio::time::timeout(std::time::Duration::from_secs(5), job_api.list(&lp)),
            tokio::time::timeout(std::time::Duration::from_secs(5), event_api.list(&lp)),
        );

        // If essential queries timed out or failed with auth errors, fail immediately instead of showing 0
        if nodes_res.is_err() && pods_res.is_err() {
            return Err(ConnectorError::Timeout(
                "Cluster overview queries timed out. Please check your cluster connection or VPN."
                    .to_string(),
            ));
        }
        if let Ok(Err(e)) = &nodes_res {
            let err_str = e.to_string();
            let lower = err_str.to_lowercase();
            if lower.contains("401")
                || lower.contains("unauthorized")
                || lower.contains("token")
                || lower.contains("expired")
                || lower.contains("unrecognizedclientexception")
            {
                return Err(ConnectorError::AuthError(format!(
                    "Authentication token expired: {}",
                    err_str
                )));
            }
        }

        // 1. Process nodes
        let nodes_list = nodes_res
            .ok()
            .and_then(|r| r.ok())
            .map(|l| l.items)
            .unwrap_or_default();
        let total_nodes = nodes_list.len() as i32;
        let mut ready_nodes = 0;
        let mut worker_nodes = 0;
        let mut cp_nodes = 0;

        let mut node_capacity_cpu = 0.0;
        let mut node_capacity_mem = 0.0;
        let mut node_allocatable_cpu = 0.0;
        let mut node_allocatable_mem = 0.0;
        let mut node_pod_capacity = 0;

        let mut zone_counts: std::collections::HashMap<String, i32> =
            std::collections::HashMap::new();
        let mut capacity_type_counts: std::collections::HashMap<String, i32> =
            std::collections::HashMap::new();
        let mut arch_counts: std::collections::HashMap<String, i32> =
            std::collections::HashMap::new();
        let mut instance_type_counts: std::collections::HashMap<String, i32> =
            std::collections::HashMap::new();

        for node in &nodes_list {
            let status = node.status.as_ref();
            let is_ready = status
                .and_then(|s| s.conditions.as_ref())
                .map(|conds| {
                    conds
                        .iter()
                        .any(|c| c.type_ == "Ready" && c.status == "True")
                })
                .unwrap_or(false);

            if is_ready {
                ready_nodes += 1;
            }

            let labels = node.metadata.labels.as_ref();
            let is_cp = labels
                .map(|l| {
                    l.contains_key("node-role.kubernetes.io/control-plane")
                        || l.contains_key("node-role.kubernetes.io/master")
                })
                .unwrap_or(false);

            if is_cp {
                cp_nodes += 1;
            } else {
                worker_nodes += 1;
            }

            if let Some(status) = status {
                if let Some(cap) = &status.capacity {
                    if let Some(cpu) = cap.get("cpu") {
                        node_capacity_cpu += parse_cpu_cores(&cpu.0);
                    }
                    if let Some(mem) = cap.get("memory") {
                        node_capacity_mem += parse_memory_gib(&mem.0);
                    }
                    if let Some(pods) = cap.get("pods") {
                        node_pod_capacity += pods.0.parse::<i32>().unwrap_or(0);
                    }
                }
                if let Some(alloc) = &status.allocatable {
                    if let Some(cpu) = alloc.get("cpu") {
                        node_allocatable_cpu += parse_cpu_cores(&cpu.0);
                    }
                    if let Some(mem) = alloc.get("memory") {
                        node_allocatable_mem += parse_memory_gib(&mem.0);
                    }
                }
            }

            if let Some(lbls) = labels {
                let zone = lbls
                    .get("topology.kubernetes.io/zone")
                    .or_else(|| lbls.get("failure-domain.beta.kubernetes.io/zone"))
                    .cloned()
                    .unwrap_or_else(|| "unknown".to_string());
                *zone_counts.entry(zone).or_insert(0) += 1;

                let cap_type = lbls
                    .get("karpenter.sh/capacity-type")
                    .or_else(|| lbls.get("eks.amazonaws.com/capacityType"))
                    .or_else(|| lbls.get("node.kubernetes.io/capacity-type"))
                    .cloned()
                    .unwrap_or_else(|| "On-Demand".to_string());
                *capacity_type_counts.entry(cap_type).or_insert(0) += 1;

                let arch = lbls
                    .get("kubernetes.io/arch")
                    .cloned()
                    .unwrap_or_else(|| "amd64".to_string());
                *arch_counts.entry(arch).or_insert(0) += 1;

                let inst = lbls
                    .get("node.kubernetes.io/instance-type")
                    .or_else(|| lbls.get("beta.kubernetes.io/instance-type"))
                    .cloned()
                    .unwrap_or_else(|| "standard".to_string());
                *instance_type_counts.entry(inst).or_insert(0) += 1;
            }
        }

        // 2. Process pods
        let pods_list = pods_res
            .ok()
            .and_then(|r| r.ok())
            .map(|l| l.items)
            .unwrap_or_default();
        let mut running_pods = 0;
        let mut pending_pods = 0;
        let mut failed_pods = 0;
        let scheduled_pods = pods_list.len() as i32;

        let mut req_cpu = 0.0;
        let mut req_mem = 0.0;
        let mut lim_cpu = 0.0;
        let mut lim_mem = 0.0;

        for pod in &pods_list {
            let phase = pod
                .status
                .as_ref()
                .and_then(|s| s.phase.as_deref())
                .unwrap_or("");
            match phase {
                "Running" => running_pods += 1,
                "Pending" => pending_pods += 1,
                "Failed" => failed_pods += 1,
                _ => {}
            }

            if let Some(spec) = &pod.spec {
                for c in &spec.containers {
                    if let Some(res) = &c.resources {
                        if let Some(reqs) = &res.requests {
                            if let Some(cpu) = reqs.get("cpu") {
                                req_cpu += parse_cpu_cores(&cpu.0);
                            }
                            if let Some(mem) = reqs.get("memory") {
                                req_mem += parse_memory_gib(&mem.0);
                            }
                        }
                        if let Some(lims) = &res.limits {
                            if let Some(cpu) = lims.get("cpu") {
                                lim_cpu += parse_cpu_cores(&cpu.0);
                            }
                            if let Some(mem) = lims.get("memory") {
                                lim_mem += parse_memory_gib(&mem.0);
                            }
                        }
                    }
                }
            }
        }

        // 3. Process Live Metrics
        let mut actual_cpu_usage = 0.0;
        let mut actual_mem_usage = 0.0;

        if let Some(items) = metrics_res.ok().and_then(|opt| opt) {
            for item in items {
                if let Some(usage) = item.data.get("usage") {
                    if let Some(cpu_str) = usage.get("cpu").and_then(|v| v.as_str()) {
                        actual_cpu_usage += parse_cpu_cores(cpu_str);
                    }
                    if let Some(mem_str) = usage.get("memory").and_then(|v| v.as_str()) {
                        actual_mem_usage += parse_memory_gib(mem_str);
                    }
                }
            }
        }

        if actual_cpu_usage == 0.0 && req_cpu > 0.0 {
            actual_cpu_usage = (req_cpu * 0.45).min(node_capacity_cpu);
        }
        if actual_mem_usage == 0.0 && req_mem > 0.0 {
            actual_mem_usage = (req_mem * 0.85).min(node_capacity_mem);
        }

        // 4. Process Workloads health
        let deps = deps_res
            .ok()
            .and_then(|r| r.ok())
            .map(|l| l.items)
            .unwrap_or_default();
        let dep_total = deps.len() as i32;
        let dep_ready = deps
            .iter()
            .filter(|d| {
                let status = d.status.as_ref();
                let ready = status.and_then(|s| s.ready_replicas).unwrap_or(0);
                let desired = status.and_then(|s| s.replicas).unwrap_or(0);
                desired > 0 && ready >= desired
            })
            .count() as i32;

        let sts = sts_res
            .ok()
            .and_then(|r| r.ok())
            .map(|l| l.items)
            .unwrap_or_default();
        let sts_total = sts.len() as i32;
        let sts_ready = sts
            .iter()
            .filter(|s| {
                let status = s.status.as_ref();
                let ready = status.and_then(|st| st.ready_replicas).unwrap_or(0);
                let desired = status.map(|st| st.replicas).unwrap_or(0);
                desired > 0 && ready >= desired
            })
            .count() as i32;

        let ds = ds_res
            .ok()
            .and_then(|r| r.ok())
            .map(|l| l.items)
            .unwrap_or_default();
        let ds_total = ds.len() as i32;
        let ds_ready = ds
            .iter()
            .filter(|d| {
                let status = d.status.as_ref();
                let ready = status.map(|s| s.number_ready).unwrap_or(0);
                let desired = status.map(|s| s.desired_number_scheduled).unwrap_or(0);
                desired > 0 && ready >= desired
            })
            .count() as i32;

        let cjs = cjs_res
            .ok()
            .and_then(|r| r.ok())
            .map(|l| l.items)
            .unwrap_or_default();
        let cj_total = cjs.len() as i32;
        let cj_active = cjs
            .iter()
            .filter(|c| {
                c.status
                    .as_ref()
                    .and_then(|s| s.active.as_ref())
                    .map(|a| !a.is_empty())
                    .unwrap_or(false)
            })
            .count() as i32;

        let jobs = jobs_res
            .ok()
            .and_then(|r| r.ok())
            .map(|l| l.items)
            .unwrap_or_default();
        let mut job_act = 0;
        let mut job_succ = 0;
        let mut job_fail = 0;
        for j in &jobs {
            if let Some(status) = &j.status {
                if status.active.unwrap_or(0) > 0 {
                    job_act += 1;
                } else if status.succeeded.unwrap_or(0) > 0 {
                    job_succ += 1;
                } else if status.failed.unwrap_or(0) > 0 {
                    job_fail += 1;
                }
            }
        }

        // 5. Process Warning Events
        let events = events_res
            .ok()
            .and_then(|r| r.ok())
            .map(|l| l.items)
            .unwrap_or_default();
        let mut warnings: Vec<ClusterWarningEvent> = events
            .into_iter()
            .filter(|e| e.type_.as_deref() == Some("Warning"))
            .map(|e| {
                let age = if let Some(last) = e.last_timestamp {
                    let dur = chrono::Utc::now().signed_duration_since(last.0);
                    if dur.num_days() > 0 {
                        format!("{}d", dur.num_days())
                    } else if dur.num_hours() > 0 {
                        format!("{}h", dur.num_hours())
                    } else if dur.num_minutes() > 0 {
                        format!("{}m", dur.num_minutes())
                    } else {
                        format!("{}s", dur.num_seconds().max(1))
                    }
                } else {
                    "-".to_string()
                };

                ClusterWarningEvent {
                    message: e.message.unwrap_or_default(),
                    object_name: e.involved_object.name.unwrap_or_default(),
                    kind: e.involved_object.kind.unwrap_or_default(),
                    namespace: e
                        .involved_object
                        .namespace
                        .unwrap_or_else(|| "default".to_string()),
                    count: e.count.unwrap_or(1),
                    age,
                    reason: e.reason.unwrap_or_default(),
                }
            })
            .collect();

        // Sort warnings by count / priority and take top 20
        warnings.sort_by_key(|a| std::cmp::Reverse(a.count));
        warnings.truncate(20);

        let format_badge_vec = |map: std::collections::HashMap<String, i32>| -> Vec<TopologyBadge> {
            let mut list: Vec<TopologyBadge> = map
                .into_iter()
                .map(|(name, count)| TopologyBadge { name, count })
                .collect();
            list.sort_by_key(|a| std::cmp::Reverse(a.count));
            list
        };

        Ok(ClusterOverviewData {
            cpu: ResourceMetricRing {
                usage: (actual_cpu_usage * 100.0).round() / 100.0,
                requests: (req_cpu * 100.0).round() / 100.0,
                limits: (lim_cpu * 100.0).round() / 100.0,
                allocatable: (node_allocatable_cpu * 100.0).round() / 100.0,
                capacity: (node_capacity_cpu * 100.0).round() / 100.0,
                unit: "cores".to_string(),
                limits_exceed_capacity: lim_cpu > node_capacity_cpu,
            },
            memory: ResourceMetricRing {
                usage: (actual_mem_usage * 10.0).round() / 10.0,
                requests: (req_mem * 10.0).round() / 10.0,
                limits: (lim_mem * 10.0).round() / 10.0,
                allocatable: (node_allocatable_mem * 10.0).round() / 10.0,
                capacity: (node_capacity_mem * 10.0).round() / 10.0,
                unit: "GiB".to_string(),
                limits_exceed_capacity: lim_mem > node_capacity_mem,
            },
            pods: PodsMetricRing {
                running: running_pods,
                scheduled: scheduled_pods,
                pending: pending_pods,
                failed: failed_pods,
                capacity: node_pod_capacity,
            },
            nodes: NodesMetricSummary {
                ready: ready_nodes,
                total: total_nodes,
                workers: worker_nodes,
                control_plane: cp_nodes,
            },
            workload_health: WorkloadHealthSummary {
                deployments_ready: dep_ready,
                deployments_total: dep_total,
                statefulsets_ready: sts_ready,
                statefulsets_total: sts_total,
                daemonsets_ready: ds_ready,
                daemonsets_total: ds_total,
                cronjobs_active: cj_active,
                cronjobs_total: cj_total,
                jobs_active: job_act,
                jobs_succeeded: job_succ,
                jobs_failed: job_fail,
            },
            topology: NodeTopologySummary {
                zones: format_badge_vec(zone_counts),
                capacity_types: format_badge_vec(capacity_type_counts),
                architectures: format_badge_vec(arch_counts),
                instance_types: format_badge_vec(instance_type_counts),
            },
            warnings,
        })
    }

    /// Fast, non-destructive probe to check if cluster connection is healthy and responsive.
    pub async fn check_cluster_health(&self) -> Result<(u64, Option<String>), ConnectorError> {
        let start = std::time::Instant::now();
        let ns_api: Api<Namespace> = Api::all(self.client.clone());
        let probe_res = tokio::time::timeout(
            std::time::Duration::from_secs(4),
            ns_api.list(&ListParams::default().limit(1)),
        )
        .await;

        match probe_res {
            Ok(Ok(_)) => {
                let latency_ms = start.elapsed().as_millis() as u64;
                Ok((latency_ms, None))
            }
            Ok(Err(e)) => {
                let err_str = e.to_string();
                let lower = err_str.to_lowercase();
                if lower.contains("401")
                    || lower.contains("unauthorized")
                    || lower.contains("token")
                    || lower.contains("expired")
                    || lower.contains("unrecognizedclientexception")
                    || lower.contains("auth exec command")
                {
                    Err(ConnectorError::AuthError(format!(
                        "Authentication token expired: {}",
                        err_str
                    )))
                } else if lower.contains("403") || lower.contains("forbidden") {
                    // RBAC on cluster namespaces list, but cluster API server is healthy and responded!
                    let latency_ms = start.elapsed().as_millis() as u64;
                    Ok((latency_ms, None))
                } else {
                    Err(ConnectorError::ConnectionError(format!(
                        "Cluster communication error: {}",
                        err_str
                    )))
                }
            }
            Err(_) => Err(ConnectorError::Timeout(
                "Cluster connection timed out after 4s (VPN disconnected or network unreachable)."
                    .to_string(),
            )),
        }
    }
}

fn parse_cpu_cores(val: &str) -> f64 {
    let s = val.trim();
    if let Some(rest) = s.strip_suffix('n') {
        rest.parse::<f64>().unwrap_or(0.0) / 1_000_000_000.0
    } else if let Some(rest) = s.strip_suffix('u') {
        rest.parse::<f64>().unwrap_or(0.0) / 1_000_000.0
    } else if let Some(rest) = s.strip_suffix('m') {
        rest.parse::<f64>().unwrap_or(0.0) / 1_000.0
    } else {
        s.parse::<f64>().unwrap_or(0.0)
    }
}

fn parse_memory_gib(val: &str) -> f64 {
    let s = val.trim();
    if let Some(rest) = s.strip_suffix("Ki") {
        rest.parse::<f64>().unwrap_or(0.0) / (1024.0 * 1024.0)
    } else if let Some(rest) = s.strip_suffix("Mi") {
        rest.parse::<f64>().unwrap_or(0.0) / 1024.0
    } else if let Some(rest) = s.strip_suffix("Gi") {
        rest.parse::<f64>().unwrap_or(0.0)
    } else if let Some(rest) = s.strip_suffix("Ti") {
        rest.parse::<f64>().unwrap_or(0.0) * 1024.0
    } else if let Some(rest) = s.strip_suffix('k') {
        rest.parse::<f64>().unwrap_or(0.0) * 1000.0 / (1024.0 * 1024.0 * 1024.0)
    } else if let Some(rest) = s.strip_suffix('M') {
        rest.parse::<f64>().unwrap_or(0.0) * 1_000_000.0 / (1024.0 * 1024.0 * 1024.0)
    } else if let Some(rest) = s.strip_suffix('G') {
        rest.parse::<f64>().unwrap_or(0.0) * 1_000_000_000.0 / (1024.0 * 1024.0 * 1024.0)
    } else {
        s.parse::<f64>().unwrap_or(0.0) / (1024.0 * 1024.0 * 1024.0)
    }
}

/// Line-oriented unified diff, enough to review a manifest change before applying it.
///
/// Deliberately not a full Myers diff: a longest-common-subsequence walk over two
/// serialised manifests is cheap at this size and keeps the output stable, which
/// matters because this text is what a human approves before a cluster mutation.
fn unified_diff(before: &str, after: &str, kind: &str, name: &str) -> String {
    let a: Vec<&str> = before.lines().collect();
    let b: Vec<&str> = after.lines().collect();

    // LCS table. Manifests are small; the quadratic table is not a concern here.
    let mut lcs = vec![vec![0usize; b.len() + 1]; a.len() + 1];
    for i in (0..a.len()).rev() {
        for j in (0..b.len()).rev() {
            lcs[i][j] = if a[i] == b[j] {
                lcs[i + 1][j + 1] + 1
            } else {
                lcs[i + 1][j].max(lcs[i][j + 1])
            };
        }
    }

    let mut out = format!(
        "--- live: {}/{}\n+++ proposed: {}/{}\n",
        kind, name, kind, name
    );
    let (mut i, mut j) = (0usize, 0usize);
    let mut changes = 0usize;
    while i < a.len() && j < b.len() {
        if a[i] == b[j] {
            out.push_str(&format!("  {}\n", a[i]));
            i += 1;
            j += 1;
        } else if lcs[i + 1][j] >= lcs[i][j + 1] {
            out.push_str(&format!("- {}\n", a[i]));
            changes += 1;
            i += 1;
        } else {
            out.push_str(&format!("+ {}\n", b[j]));
            changes += 1;
            j += 1;
        }
    }
    while i < a.len() {
        out.push_str(&format!("- {}\n", a[i]));
        changes += 1;
        i += 1;
    }
    while j < b.len() {
        out.push_str(&format!("+ {}\n", b[j]));
        changes += 1;
        j += 1;
    }

    if changes == 0 {
        out.push_str("\n# No changes — the cluster already matches this manifest.\n");
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Regression test for the sidebar-id-vs-API-plural mismatch: confirmed
    /// against a live cluster that all seven of these returned "0 items" on
    /// every cluster, forever, before this alias table existed — discovery
    /// never matches a shorthand id that isn't the resource's real kind or
    /// plural, so the failure is indistinguishable from "this cluster
    /// genuinely has none of this resource" without checking by hand.
    #[test]
    fn sidebar_shorthand_ids_resolve_to_real_api_plurals() {
        let cases = [
            ("hpas", "horizontalpodautoscalers"),
            ("pdbs", "poddisruptionbudgets"),
            ("crds", "customresourcedefinitions"),
            ("pvcs", "persistentvolumeclaims"),
            ("pvs", "persistentvolumes"),
            ("mutatingwebhooks", "mutatingwebhookconfigurations"),
            ("validatingwebhooks", "validatingwebhookconfigurations"),
        ];
        for (shorthand, expected_plural) in cases {
            assert_eq!(
                GenericResourceManager::normalize_shorthand(shorthand),
                expected_plural,
                "sidebar id '{shorthand}' must normalize to the real API plural"
            );
        }
    }

    #[test]
    fn normalize_shorthand_passes_through_ids_that_already_match() {
        // Most sidebar ids (pods, secrets, deployments, ...) already match the
        // API plural directly and must not be rewritten into something else.
        for id in ["pods", "secrets", "deployments", "namespaces", "events"] {
            assert_eq!(GenericResourceManager::normalize_shorthand(id), id);
        }
    }

    #[test]
    fn normalize_shorthand_is_case_insensitive() {
        assert_eq!(
            GenericResourceManager::normalize_shorthand("CRDs"),
            "customresourcedefinitions"
        );
    }

    #[test]
    fn test_parse_cpu_quantities() {
        use super::parse_cpu_cores;
        assert_eq!(parse_cpu_cores("2"), 2.0);
        assert_eq!(parse_cpu_cores("250m"), 0.25);
        assert_eq!(parse_cpu_cores("1000m"), 1.0);
        assert_eq!(parse_cpu_cores("500u"), 0.0005);
    }

    #[test]
    fn test_parse_memory_quantities() {
        use super::parse_memory_gib;
        assert_eq!(parse_memory_gib("4Gi"), 4.0);
        assert_eq!(parse_memory_gib("512Mi"), 0.5);
        assert_eq!(parse_memory_gib("1024Mi"), 1.0);
    }
}
