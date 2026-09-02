# AI Copilot Layer Architecture

The **AI Copilot Layer** provides intelligent operational assistance while preserving zero-trust security invariants.

---

## 1. Core Principles

```
User Prompt
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│              AI Assistant Engine (Rust Core)            │
│  - Redact Secrets & Credentials from context            │
│  - Demarcate cluster data as UNTRUSTED DATA             │
│  - Tool Whitelist Dispatcher                            │
└──────────┬─────────────────────────────┬────────────────┘
           │                             │
    [Read Tool Call]             [Mutating Tool Call]
           │                             │
           ▼                             ▼
Executes within RBAC Context     Generates Dry-Run Diff
           │                             │
           ▼                             ▼
Returns result to LLM            UI Prompts User for Confirmation
                                 (Approve / Reject)
                                         │
                                         ├─[Approved]──► Executes on Cluster
                                         └─[Rejected]──► Aborts action
```

---

## 2. Fixed Tool Whitelist

The AI engine can invoke **only** the following 5 tools:
1. `list_pods(namespace?: string)`: Retrieves pod summaries in a namespace.
2. `describe_resource(kind: string, name: string, namespace?: string)`: Fetches sanitized YAML/JSON specification.
3. `get_logs(namespace: string, pod_name: string, container?: string, tail_lines?: number)`: Fetches recent log lines.
4. `scale_deployment(namespace: string, name: string, replicas: number)`: Mutating. Generates diff and requires user approval.
5. `apply_manifest(manifest_yaml: string, namespace?: string)`: Mutating. Runs server-side dry-run, presents diff to user, and requires explicit click to apply.

---

## 3. Provider Independence (`ModelProvider`)

Supported backends via pluggable trait:
- **Anthropic Claude** (via API key stored in OS keychain)
- **OpenAI GPT** (via API key stored in OS keychain)
- **Local Ollama / Llama.cpp** (local HTTP endpoint, 100% air-gapped with no cloud data transmission)
