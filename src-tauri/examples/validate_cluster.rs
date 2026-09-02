//! Read-only validation of the real cluster path.
//!
//! Exercises exactly what the app calls — kubeconfig load, discovery, the
//! generic resource manager, logs, and containers — against a live cluster,
//! using the exact sidebar `id` strings the frontend sends. This is how the
//! "sidebar says 35 kinds, app.tsx sends these ids" mismatch class of bug
//! gets caught: kubectl's plural name and the UI's shorthand id are not
//! always the same string, and discovery only resolves on kind/plural.
//!
//! Every call here is a GET or a LIST. Nothing is created, patched, or deleted.
//!
//!   cargo run --example validate_cluster                 # current context
//!   cargo run --example validate_cluster -- <context>    # a specific one

use k8s_ui::core::resource_manager::GenericResourceManager;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    k8s_ui::core::install_crypto_provider();

    let requested = std::env::args().nth(1);

    let kubeconfig = kube::config::Kubeconfig::read()?;
    let context = requested
        .or_else(|| kubeconfig.current_context.clone())
        .ok_or("no context given and no current-context in kubeconfig")?;

    println!("context   {context}");

    let options = kube::config::KubeConfigOptions {
        context: Some(context.clone()),
        cluster: None,
        user: None,
    };
    let config = kube::Config::from_kubeconfig(&options).await?;
    println!("server    {}", config.cluster_url);

    let client = kube::Client::try_from(config)?;
    let mgr = GenericResourceManager::new(client);
    println!("manager ready\n");

    let namespaces = mgr.list_namespaces().await?;
    println!("namespaces  {} found", namespaces.len());

    let pods = mgr.list_pods(None).await?;
    println!("pods (typed) {} across all namespaces", pods.len());

    // Exactly the ids in src/components/layout/Sidebar.tsx, paired with the
    // kubectl ground truth captured against this same context immediately
    // before this run (`kubectl --context <ctx> get <kind> -A --no-headers | wc -l`).
    // A mismatch here is either a real discrepancy or a shorthand id that
    // discovery cannot resolve — both are bugs worth knowing about.
    let sidebar = [
        ("nodes", 4),
        ("events", 9),
        ("namespaces", 11),
        ("mutatingwebhooks", 4), // ground truth: mutatingwebhookconfigurations
        ("validatingwebhooks", 5), // ground truth: validatingwebhookconfigurations
        ("pods", 52),
        ("deployments", 30),
        ("daemonsets", 5),
        ("statefulsets", 2),
        ("replicasets", 205),
        ("jobs", 2),
        ("cronjobs", 0),
        ("configmaps", 38),
        ("secrets", 180),
        ("resourcequotas", 0),
        ("limitranges", 0),
        ("hpas", 16), // ground truth: horizontalpodautoscalers
        ("pdbs", 4),  // ground truth: poddisruptionbudgets
        ("priorityclasses", 2),
        ("services", 34),
        ("endpoints", 34),
        ("ingresses", 16),
        ("ingressclasses", 1),
        ("networkpolicies", 0),
        ("pvcs", 2), // ground truth: persistentvolumeclaims
        ("pvs", 2),  // ground truth: persistentvolumes
        ("storageclasses", 1),
        ("serviceaccounts", 70),
        ("clusterroles", 126),
        ("clusterrolebindings", 110),
        ("roles", 29),
        ("rolebindings", 34),
        ("crds", 47), // ground truth: customresourcedefinitions
    ];

    println!(
        "\n{:<24} {:>10} {:>10}  status",
        "sidebar id", "app", "kubectl"
    );
    println!("{}", "-".repeat(60));
    let (mut matched, mut mismatched, mut broken) = (0, 0, 0);
    for (id, expected) in sidebar {
        match mgr.list_resources(id, None).await {
            Ok(items) => {
                let got = items.len();
                if got == expected {
                    matched += 1;
                    println!("{:<24} {:>10} {:>10}  ok", id, got, expected);
                } else {
                    mismatched += 1;
                    println!("{:<24} {:>10} {:>10}  COUNT MISMATCH", id, got, expected);
                }
            }
            Err(e) => {
                broken += 1;
                let msg = e.to_string();
                let short = msg.lines().next().unwrap_or(&msg);
                println!(
                    "{:<24} {:>10} {:>10}  UNRESOLVED — {}",
                    id, "-", expected, short
                );
            }
        }
    }
    println!(
        "\n{matched} match kubectl exactly, {mismatched} count mismatch, {broken} unresolved (id doesn't map to a real API resource)."
    );

    // Secret handling specifically — the sidebar id resolves fine, but does
    // fetching a single Secret's YAML expose its data unredacted?
    println!("\n--- secret content check ---");
    let secrets = mgr.list_resources("secrets", None).await?;
    if let Some(first) = secrets.first() {
        let name = first.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let ns = first
            .get("namespace")
            .and_then(|v| v.as_str())
            .unwrap_or("default");
        match mgr.get_resource_yaml("secrets", name, Some(ns)).await {
            Ok(yaml) => {
                let redacted = yaml.contains("REDACTED_SECRET_VALUES");
                println!("sample     {ns}/{name}");
                println!("redacted:  {redacted}");
                if !redacted {
                    println!("⚠ get_resource_yaml returns Secret .data unredacted (base64, but real values).");
                }
            }
            Err(e) => println!("could not fetch: {e}"),
        }
    } else {
        println!("no secrets in this cluster to sample");
    }

    // Logs + containers against one real running pod, if any exist.
    println!("\n--- logs & containers on a live pod ---");
    if let Some(p) = pods.iter().find(|p| p.status == "Running") {
        match mgr.list_containers(&p.namespace, &p.name).await {
            Ok(containers) => {
                println!("containers  {}/{} -> {:?}", p.namespace, p.name, containers)
            }
            Err(e) => println!("list_containers failed: {e}"),
        }
        match mgr
            .get_logs(&p.namespace, &p.name, None, Some(5), false, true)
            .await
        {
            Ok(logs) => {
                let lines = logs.lines().count();
                println!("logs        {} line(s) retrieved (tail 5 requested)", lines);
            }
            Err(e) => println!("get_logs failed: {e}"),
        }
    } else {
        println!("no Running pod found to sample");
    }

    // Custom resource instance listing — proves the generic layer already
    // handles CRDs, not just their schemas.
    println!("\n--- custom resource instance listing ---");
    for kind in ["certificates", "scaledobjects", "clusterissuers"] {
        match mgr.list_resources(kind, None).await {
            Ok(items) => println!("{:<20} {} instance(s)", kind, items.len()),
            Err(e) => println!("{:<20} FAILED: {}", kind, e),
        }
    }

    // Dynamic CRD type discovery — this is what powers real navigation into
    // custom resources, instead of the sidebar's old single hardcoded
    // "Definitions" entry.
    println!("\n--- dynamic CRD type discovery ---");
    match mgr.list_custom_resource_types().await {
        Ok(types) => {
            println!("{} custom resource types discovered", types.len());
            let mut by_group: std::collections::BTreeMap<String, Vec<&serde_json::Value>> =
                Default::default();
            for t in &types {
                let group = t
                    .get("group")
                    .and_then(|g| g.as_str())
                    .unwrap_or("?")
                    .to_string();
                by_group.entry(group).or_default().push(t);
            }
            for (group, kinds) in by_group.iter().take(6) {
                println!("  {group}");
                for k in kinds.iter().take(4) {
                    println!(
                        "    {:<28} plural={:<28} established={}",
                        k.get("kind").and_then(|v| v.as_str()).unwrap_or("?"),
                        k.get("plural").and_then(|v| v.as_str()).unwrap_or("?"),
                        k.get("established")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false),
                    );
                }
            }
        }
        Err(e) => println!("FAILED: {e}"),
    }

    // Cluster-wide dashboard metrics — the "cpu consumes memory consumes"
    // numbers the dashboard is supposed to show.
    println!("\n--- cluster overview (dashboard metrics) ---");
    match mgr.get_cluster_overview().await {
        Ok(o) => {
            println!(
                "cpu     usage={:.2} req={:.2} lim={:.2} alloc={:.2} cap={:.2} {}",
                o.cpu.usage,
                o.cpu.requests,
                o.cpu.limits,
                o.cpu.allocatable,
                o.cpu.capacity,
                o.cpu.unit
            );
            println!(
                "memory  usage={:.2} req={:.2} lim={:.2} alloc={:.2} cap={:.2} {}",
                o.memory.usage,
                o.memory.requests,
                o.memory.limits,
                o.memory.allocatable,
                o.memory.capacity,
                o.memory.unit
            );
            println!(
                "nodes   ready={}/{} workers={} control_plane={}",
                o.nodes.ready, o.nodes.total, o.nodes.workers, o.nodes.control_plane
            );
            println!(
                "pods    running={} pending={} failed={} capacity={}",
                o.pods.running, o.pods.pending, o.pods.failed, o.pods.capacity
            );
            println!(
                "workloads deployments={}/{} statefulsets={}/{} daemonsets={}/{}",
                o.workload_health.deployments_ready,
                o.workload_health.deployments_total,
                o.workload_health.statefulsets_ready,
                o.workload_health.statefulsets_total,
                o.workload_health.daemonsets_ready,
                o.workload_health.daemonsets_total
            );
            println!("warnings {} recent", o.warnings.len());
        }
        Err(e) => println!("FAILED: {e}"),
    }

    // The exact path the new YAML editor / describe modals use.
    println!("\n--- get_resource_yaml / describe_resource on a real Deployment ---");
    let deps = mgr.list_resources("deployments", None).await?;
    if let Some(d) = deps.first() {
        let name = d.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let ns = d
            .get("namespace")
            .and_then(|v| v.as_str())
            .unwrap_or("default");
        match mgr.get_resource_yaml("deployments", name, Some(ns)).await {
            Ok(yaml) => println!(
                "get_resource_yaml ok — {} bytes for {}/{}",
                yaml.len(),
                ns,
                name
            ),
            Err(e) => println!("get_resource_yaml FAILED: {e}"),
        }
        match mgr.describe_resource("deployments", name, Some(ns)).await {
            Ok(desc) => println!("describe_resource ok — {} bytes", desc.len()),
            Err(e) => println!("describe_resource FAILED: {e}"),
        }
    }

    Ok(())
}
