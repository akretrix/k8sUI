# k8sUI Custom Agents Ecosystem

This directory contains the custom agents and rules configured for the **k8sUI** repository, following the [Google Antigravity Custom Agents specification](https://antigravity.google/blog/introducing-custom-agents).

## Available Agents (`.agents/agents/`)

| Agent | File | Primary Scope | Permitted Modes |
| :--- | :--- | :--- | :--- |
| **build-release** | [`build-release.md`](./agents/build-release.md) | Tauri v2 & Vite packaging, version sync, changelogs, CI/CD validation | Main Agent & Subagent |
| **security** | [`security.md`](./agents/security.md) | Tauri IPC audits, CSP checks, gitleaks, zero-cloud-mutation compliance, dependency scans | Main Agent & Subagent |
| **design-module** | [`design-module.md`](./agents/design-module.md) | UI/UX design tokens, dark mode palette, Tailwind CSS, Lucide icons, desktop layouts | Main Agent & Subagent |
| **test** | [`test.md`](./agents/test.md) | Vitest unit/component tests, RTL test suites, Tauri IPC mocks, Playwright E2E | Main Agent & Subagent |
| **monitoring** | [`monitoring.md`](./agents/monitoring.md) | Live logs streaming, terminated container logs (`--previous`), Loki/Tempo/Prometheus, telemetry | Main Agent & Subagent |

---

## How to Run Custom Agents

### 1. Directly as a Main Agent (Antigravity 2.0 GUI)
Select any custom agent directly from the agent dropdown selector in the top bar of the Antigravity 2.0 desktop interface. The agent adopts the designated system prompt, curated toolset, and execution policies.

### 2. Via Antigravity CLI
Run an agent directly from your terminal:
```bash
# Run the test agent
agy --agent test

# Run the build-release agent
agy --agent build-release

# Run the security auditor
agy --agent security
```

### 3. As Delegated Subagents
When interacting with the general coordinator agent in Antigravity, the coordinator can autonomously delegate specialized tasks to any of these agents without polluting the primary context window.
