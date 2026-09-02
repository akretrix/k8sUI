# ADR 0003: Native Cluster Communication via kube-rs Instead of kubectl Subprocesses

## Status
Accepted

## Context
Many Kubernetes GUIs rely on executing the local `kubectl` CLI binary via background subprocesses (e.g. `exec("kubectl get pods -o json")`) to interact with clusters.

While this pattern is quick to prototype, it exhibits critical security, reliability, and performance defects:
1. **Subprocess Injection Vulnerability**: Passing resource names, labels, or manifests via command-line arguments or shell strings risks command injection if untrusted cluster input contains shell metacharacters.
2. **Environment & Dependency Fragility**: Relying on an external `kubectl` binary assumes it is installed on the host system, present in PATH, compatible in version with the target cluster API, and configured identically across developers.
3. **High Overhead & Serialization Inefficiency**: Spawning subprocesses, parsing raw JSON/YAML text stdout repeatedly, and polling instead of streaming creates high CPU and memory overhead.
4. **Subresource & Streaming Limitations**: Interactive subresources like `exec` (SPDY / WebSocket terminal streaming) and `port-forward` are difficult to manage, proxy, and securely terminate when wrapped around child processes.

## Decision
1. **Direct API Integration**: We use **`kube-rs`** and **`k8s-openapi`** natively in the Rust core for all core application operations:
   - Resource listing, getting, applying, deleting, and scaling.
   - Real-time Kubernetes `Watch` streams (eliminating polling).
   - Interactive container terminal sessions via the Kubernetes `exec` subresource API (WebSocket / SPDY attached process).
   - Container port-forwarding via native Kubernetes `portforward` subresource streams.
2. **Strict Rule Against `kubectl` Subprocesses**: The core application logic MUST NOT shell out or spawn `kubectl` subprocesses under any circumstances.
3. **Optional Future Escape Hatch**: An optional "Open in External Terminal" feature may be provided strictly as a user-initiated desktop launch into the system terminal with explicitly escaped argument vectors (never shell strings), but never wired into core app data fetching or mutations.

## Consequences

### Positive
- **Immunity to Command Injection**: Direct API calls over TLS eliminate shell execution and CLI argument injection vectors.
- **Zero Host Prerequisites**: The desktop app runs independently of whether `kubectl` is installed on the host machine.
- **Efficient Streaming**: Live watches, logs, and exec sessions are handled asynchronously with Tokio tasks and Rust memory safety.
- **Fine-Grained Error Handling**: Detailed API server error codes and admission webhook rejections are parsed natively without scraping CLI stderr text.

### Negative / Trade-offs
- **API Surface Scope**: Any custom CRD or specialized Kubernetes subresource must be handled via dynamic API types (`kube::api::DynamicObject`) or generated structs rather than relying on `kubectl` plugins.
