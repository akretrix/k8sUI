# ADR 0004: AI Copilot Layer with Fixed Tool Whitelist and Mandatory Human Confirmation

## Status
Accepted

## Context
Integrating Large Language Models (LLMs) to assist with Kubernetes operations provides high user utility (natural language queries, cluster troubleshooting, resource synthesis). However, in a security-focused cluster administration tool, autonomous AI execution introduces extreme operational and security risks:
1. **Indirect Prompt Injection**: Malicious actors can embed prompt-injection payloads into untrusted cluster resources (e.g. Pod names, error logs, ConfigMap values, annotations). If an LLM is given broad execution privileges, a prompt injection could trigger unauthorized cluster mutations or data exfiltration.
2. **Hallucinated or Destructive Mutations**: Autonomous execution of generated manifests or commands could delete production namespaces or degrade workloads.
3. **Privilege Escalation**: AI tools must never bypass the active cluster connection's RBAC boundaries or session permissions.
4. **Data Exfiltration to Hosted APIs**: Sending raw cluster secrets or token data to hosted AI providers violates zero-trust policies and data protection regulations.

## Decision
We enforce the following architectural constraints for the AI Copilot layer:

1. **Strict Tool Whitelist**:
   The AI layer is restricted to a compile-time fixed whitelist of five explicit tools:
   - `list_pods` (read)
   - `describe_resource` (read)
   - `get_logs` (read)
   - `scale_deployment` (mutating)
   - `apply_manifest` (mutating)
   Generic or open-ended tools (e.g. `execute_bash`, `run_command`, `raw_http_request`) are strictly prohibited.

2. **Mandatory Human-in-the-Loop Confirmation for Mutations**:
   - Read-only tools (`list_pods`, `describe_resource`, `get_logs`) may execute automatically.
   - Any mutating tool call (`scale_deployment`, `apply_manifest`) is intercepted and converted into a pending proposal.
   - The user must review a side-by-side dry-run diff and explicitly click **Approve & Apply** before the mutation is sent to the cluster API.

3. **Untrusted Context Boundary**:
   - All cluster data (resource names, labels, logs, YAML specs) injected into the prompt context is demarcated as untrusted user data.
   - A single conversation turn CANNOT both consume untrusted cluster output and execute a mutating action without an intervening user confirmation step.

4. **Secret Redaction Engine & Privacy Controls**:
   - All Secret values and recognized credential tokens (AWS keys, Bearer tokens, private keys) are scrubbed before prompt transmission.
   - Hosted AI provider usage is strictly opt-in and disabled by default.
   - Local self-hosted models (via Ollama or OpenAI-compatible local endpoints) are supported as first-class citizens via a unified `ModelProvider` trait.

5. **Audit Logging**:
   - Every AI-proposed action and user resolution (`proposed`, `approved`, `rejected`, `executed`) is logged to the local tamper-evident audit trail tagged with `origin: "ai_copilot"`.

## Consequences

### Positive
- **Deterministic & Safe**: Eliminates prompt-injection RCE and accidental catastrophic cluster mutations.
- **Zero Privilege Escalation**: AI operations execute strictly through the active user session's scoped `ClusterConnector`.
- **Compliance & Privacy**: Prevents credential leakage to third-party model providers and supports air-gapped environments via local Ollama inference.

### Negative / Trade-offs
- **Slight Friction for Mutations**: Users must manually review and confirm mutating actions rather than fully autonomous self-healing workflows.
