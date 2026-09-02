# k8sUI Architecture Overview

k8sUI is structured into a clean, zero-trust layered desktop architecture. There is **no intermediary relay or cloud backend operated by the project**; the desktop application interacts directly with Kubernetes API servers and cloud authentication providers.

```
┌──────────────────────────────────────────────────────────┐
│                    UI Layer (React)                      │
│      React + Vite + TypeScript + Tailwind + shadcn/ui    │
│            @tanstack/react-query / react-table           │
└────────────────────────────┬─────────────────────────────┘
                             │ Strongly typed Tauri IPC (No raw tokens)
┌────────────────────────────▼─────────────────────────────┐
│                 App Core Layer (Rust)                    │
│    Credential Broker, Session State, Scoped RBAC Cache   │
│           Local Tamper-Evident Audit Log                 │
└──────────────┬────────────────────────────┬──────────────┘
               │ (Optional)                 │ Native API calls
┌──────────────▼─────────────┐ ┌────────────▼──────────────┐
│      AI Copilot Layer      │ │      Connector Layer      │
│ (Tool Whitelist & Human-in-│ │ (ClusterConnector Trait)  │
│  the-loop Diff Enforcement)│ │ EKS, AKS, Local Connectors│
└──────────────┬─────────────┘ └────────────┬──────────────┘
               │                            │
               ▼                            ▼
      Model Providers              Cluster API Servers
(Anthropic, OpenAI, Ollama)    (Direct TLS + Short-lived tokens)
```

---

## 1. UI Layer (React + TypeScript)
- Operates inside Tauri's sandboxed WebView with no Node.js runtime and zero filesystem or network socket access.
- Communicates with the Rust backend solely through Tauri IPC commands (`invoke()`) and typed event listeners.
- **Never receives or stores raw cloud credentials, AWS keys, Azure service principals, or Kubernetes tokens.** All data passed to the UI is already scoped and sanitized.

## 2. App Core Layer (Rust)
- **Credential Broker**: Obtains and manages short-lived authentication credentials in memory without writing plaintext tokens to disk.
- **Session State**: Maintains the active cluster connection context, enforces environment tagging (e.g. `production`, `staging`, `development`), and enforces the default **Read-Only Mode**.
- **Audit Logger**: Maintains a local, tamper-evident JSON audit log recording all privileged and mutating actions (including origin tags indicating manual vs AI initiation).
- **Redaction Engine**: Filters credential tokens, private keys, and sensitive ConfigMap/Secret values before logs or telemetry can leave memory.

## 3. Connector Layer (`ClusterConnector`)
- Pluggable Rust trait (`ClusterConnector`) defining all Kubernetes interactions (`list_pods`, `watch_pods`, `apply_resource`, `scale_resource`, `exec_terminal`, `port_forward`).
- Specific implementations for each environment:
  - `LocalConnector`: Handles local kind/minikube/kubeconfig contexts.
  - `EksConnector`: Integrates with official `aws-sdk-sts` to generate short-lived signed STS tokens.
  - `AksConnector`: Integrates with official `azure_identity` for AAD token exchange (kubelogin style).
- **Direct API Server Connections**: Connects strictly using `kube-rs` over TLS with valid certificate verification.

## 4. AI Copilot Layer (Optional / Guarded)
- Pluggable LLM provider trait (`AnthropicProvider`, `OpenAIProvider`, `OllamaProvider`).
- Interacts **only** with a fixed compile-time whitelist of tools.
- Read actions execute within session RBAC boundaries; mutating actions generate side-by-side dry-run diffs requiring explicit user confirmation before touching the connector layer.

---

## 5. Project Directory Structure

```
k9sUI/
├── .github/                     # CI/CD Workflows, release automation, and linting
├── assets/                      # Master Brand vectors, icons, and state illustrations
│   ├── brand/                   # 512x512 Master app icon, vector favicon, symbols, monochrome
│   ├── illustrations/           # Standalone SVG illustrations for DevOps cluster states
│   └── icons/                   # Custom workload and resource type icons
│
├── docs/                        # Engineering Architecture, Security & UX Specifications
│   ├── adr/                     # Architectural Decision Records
│   ├── architecture/            # Component diagrams, release pipeline, AWS SSO specs
│   ├── development/             # Local setup guides, pnpm standards
│   ├── security/                # Threat model, AI safety, dependency policy
│   └── ux/                      # Design tokens, brand colors, navigation principles
│
├── public/                      # Static web assets, web favicon, PWA icons
│
├── src/                         # Frontend Application (React 18, TypeScript, Tailwind)
│   ├── api/                     # Tauri IPC Client & resilient browser mock fallback
│   ├── assets/brand/            # Reactive SVG brand components & empty-state illustrations
│   ├── components/              # Modular UI components
│   │   ├── ai/                  # AI Copilot Drawer & dry-run proposal cards
│   │   ├── audit/               # Tamper-evident Audit Log viewer modal
│   │   ├── cluster/             # Cluster Switcher, Read-Only toggle, AWS SSO org registration
│   │   ├── command-palette/     # ⌘K Global Command Palette search
│   │   ├── common/              # GenericResourceTable, DescribeModal, YamlEditor, LogsModal
│   │   ├── dashboard/           # ClusterDashboard overview metrics & node rings
│   │   ├── design-system/       # Interactive Multiplatform Design System Showcase
│   │   ├── layout/              # Header, Collapsible Sidebar, Multi-Tab Bar
│   │   ├── pods/                # PodTable, telemetry sparklines, container metrics
│   │   ├── portforward/         # PortForwardModal active tunnel manager
│   │   └── terminal/            # TerminalModal interactive xterm.js PTY shell
│   ├── test/                    # Vitest test setup and mock helpers
│   └── types/                   # Strongly-typed TypeScript interfaces
│
├── src-tauri/                   # Rust Desktop Core (Tauri 2.0, kube-rs, AWS/Azure SDKs)
│   ├── src/
│   │   ├── ai/                  # LLM providers, tool whitelist & prompt framing
│   │   ├── commands/            # Tauri IPC command entrypoints
│   │   ├── connector/           # EKS, AKS, and Local kube-rs connectors
│   │   ├── core/                # Credential broker, session, audit trail, resource manager
│   │   ├── portforward/         # TCP port-forwarding streaming subsystem
│   │   └── terminal/            # WebSocket PTY container exec subsystem
│   └── tauri.conf.json          # Tauri application manifest and security capability config
│
├── tailwind.config.js           # Design system tokens and semantic color mapping
├── vite.config.ts               # Vite bundler and Vitest configuration
└── package.json                 # Frontend dependencies (pnpm managed)
```

