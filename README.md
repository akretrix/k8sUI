<div align="center">

<!-- Replace with your actual logo -->
<img src="assets/logo.png" alt="k8sUI Logo" width="96" height="96" />

# k8sUI

**Enterprise-grade, open-source Kubernetes desktop manager for multi-cloud & local clusters.**

[![GitHub Release](https://img.shields.io/github/v/release/akretrix/k8sUI?sort=semver&logo=github)](https://github.com/akretrix/k8sUI/releases)
[![CI Status](https://github.com/akretrix/k8sUI/actions/workflows/ci.yml/badge.svg)](https://github.com/akretrix/k8sUI/actions/workflows/ci.yml)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri-FFC131?logo=tauri&logoColor=white)](https://tauri.app/)
[![Built with React](https://img.shields.io/badge/built%20with-React-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)]()
<br>
[![GitHub License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![DCO](https://img.shields.io/badge/DCO-1.1_Signed--off--by-brightgreen.svg)](CONTRIBUTING.md#1-developer-certificate-of-origin-dco)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20us-amber?logo=ko-fi)](https://ko-fi.com/akretrix)

<!-- Replace with your actual UI demo GIF -->
<!-- ![k8sUI Demo](assets/demo.gif) -->

</div>

---

**k8sUI** is a zero-Electron, native desktop application for managing Kubernetes clusters across **Amazon EKS**, **Azure AKS**, and **local environments** — built with Tauri v2 + Rust + React. It replaces fragile `kubectl` shell scripts with a secure, observable, production-ready GUI without the overhead of a full web platform.

---

## ✨ Features

### 🔐 Security-First Architecture
- **Zero `kubectl` Subprocesses** — All cluster operations (list, watch, apply, logs, exec, port-forward) run directly through [`kube-rs`](https://kube.rs) over native TLS. No shell escaping, no CLI version drift.
- **Short-Lived Cloud Credentials** — AWS authentication uses official `aws-sdk-sts` + `aws-config`; Azure uses `azure_identity`. No long-lived keys are stored on disk.
- **Sandboxed Native Shell** — Built on Tauri v2: a minimal Rust core + strictly scoped WebView. No Node.js runtime, no Chromium bloat, no Electron attack surface.
- **Local Tamper-Evident Audit Log** — Every privileged action is recorded locally in a structured JSON audit log with export capability.

### ☁️ Multi-Cloud & Local Clusters
- **AWS EKS** with SSO auto-discovery — detects all accessible EKS clusters across your AWS organization accounts.
- **Azure AKS** with Azure AD / Entra ID authentication.
- **Local clusters** — `kind`, `minikube`, and `k3d` fully supported via kubeconfig auto-detection.
- Persistent cluster switcher with **environment color-coding** (Production = Red, Staging = Amber, Local = Blue/Green).

### 🛡️ Safe Write Operations by Default
- **Read-Only Mode enabled by default** — write access requires explicit user confirmation per session.
- **Server-side dry-run diff viewer** — every mutation or scaling action previews a unified diff before being applied.
- **Confirmation guardrails** — destructive operations (delete, scale-to-zero) require explicit modal sign-off.

### 🧭 Full Kubernetes Resource Coverage
- **Workloads**: Pods, Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs, CronJobs
- **Networking**: Services, Ingresses, Ingress Classes, Network Policies, Endpoints
- **Config & Secrets**: ConfigMaps, Secrets, Resource Quotas, Limit Ranges
- **Storage**: PVCs, Persistent Volumes, Storage Classes
- **Access Control**: ServiceAccounts, Roles, RoleBindings, ClusterRoles, ClusterRoleBindings
- **Policy**: HPAs, PDBs, Priority Classes
- **Security**: ValidatingWebhookConfigurations, MutatingWebhookConfigurations
- **Custom Resources (CRDs)** — dynamically discovered and grouped by API group with live instance browsing

### 🤖 AI Copilot (Optional, Air-Gap Friendly)
- Fixed 5-tool whitelist: `list_pods`, `describe_resource`, `get_logs`, `scale_deployment`, `apply_manifest`.
- Read tools execute within your existing session RBAC. Mutating tools require explicit human dry-run confirmation.
- Secret redaction engine scrubs sensitive values before any context reaches the LLM.
- Pluggable provider trait — supports local [Ollama](https://ollama.ai) for fully air-gapped environments, plus Anthropic / OpenAI.

### 🛠️ Developer Experience
- **Global Command Palette** (`Cmd/Ctrl + K`) for instant resource navigation.
- **Live log streaming** with integrated xterm.js terminal emulator.
- **Port-Forward manager** — create, list, and teardown port forwards without leaving the app.
- **YAML viewer & editor** with server-side validation before apply.
- **Helm release manager** — list releases, view manifests, and inspect revision history.

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Notes |
| :--- | :--- | :--- |
| [Node.js](https://nodejs.org) | v20+ | Use `nvm` or `fnm` for version management |
| [pnpm](https://pnpm.io) | v9+ | Required package manager (no `npm`/`yarn`) |
| [Rust](https://rustup.rs) | stable | `rustup update stable` |
| Xcode CLT (macOS) | latest | `xcode-select --install` |

### 1. Clone & Install

```bash
git clone https://github.com/akretrix/k8sUI.git
cd k8sUI
pnpm install
```

### 2. Browser Preview (Mock API — no cluster required)

```bash
pnpm run dev
```

Opens at `http://localhost:5173` with a fully-functional mock cluster for UI development.

### 3. Native Desktop App (Tauri v2 + live cluster)

```bash
pnpm run tauri dev
```

> **Prerequisites**: A valid `~/.kube/config` or active AWS SSO session for EKS discovery.

### 4. Run All Checks

```bash
# Frontend
pnpm run lint
pnpm test

# Rust backend
cargo fmt --all --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo deny check --config deny.toml
```

---

## 📖 Architecture

```
UI (React + TanStack Query)
    ↕ Tauri IPC (typed commands, event subscriptions)
Rust Core (Credential Broker · Session State · Audit Logger)
    ↕ ClusterConnector Trait
Connector Implementations: EKS · AKS · Local (kubeconfig)
    ↕ Native TLS
Kubernetes API Servers
```

Full technical documentation:

| Document | Description |
| :--- | :--- |
| [Architecture Overview](docs/architecture/overview.md) | System design, component boundaries |
| [Connector Layer](docs/architecture/connector-layer.md) | EKS / AKS / Local connector implementations |
| [AWS SSO Auto-Discovery](docs/architecture/aws-sso-discovery.md) | Cross-account EKS discovery flow |
| [AI Copilot Layer](docs/architecture/ai-copilot.md) | LLM integration, safety invariants |
| [Threat Model (STRIDE)](docs/security/THREAT_MODEL.md) | Security threat analysis |
| [Dependency & Supply-Chain Policy](docs/security/dependency-policy.md) | License & supply-chain enforcement |
| [Architecture Decision Records](docs/adr/) | ADR log for major design decisions |

---

## 🤝 Contributing

We welcome contributions of all sizes — bug fixes, new connector features, documentation improvements, and UI polish.

**Before you open a PR:**
1. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the DCO sign-off requirement and dependency license policy.
2. Ensure all CI gates pass locally (see [Run All Checks](#4-run-all-checks) above).
3. Sign every commit with `git commit -s`.

All contributions are made under the [Apache-2.0 License](LICENSE). We use a **Developer Certificate of Origin (DCO)** instead of a CLA — no legal paperwork, just a `Signed-off-by:` trailer on your commits.

---

## 💛 Sponsorship

k8sUI is free and open-source, and we intend to keep it that way. Running this project sustainably requires:

- **CI/CD infrastructure** — macOS runners for Tauri/Rust builds are expensive.
- **Code-signing certificates** — Apple Developer ID + Windows EV signing certificates are required to distribute the app without OS-level security warnings. Without them, users must manually bypass Gatekeeper / SmartScreen on every install.
- **Domain & release infrastructure** — hosting, CDN, and artifact storage.

If k8sUI saves you or your team time, please consider sponsoring:

- Helps cover the costs of signing certificates and infrastructure.
- Supports dedicated development time for new features.
- **[☕ Support us on Ko-fi](https://ko-fi.com/akretrix)**

</div>

### Corporate Backers

If your organization uses k8sUI in production and wants to ensure its long-term development:

- Logo placement in this README and on the project website
- Priority issue triage for your use cases
- Acknowledgment in release notes

Contact us at **sponsors@akretrix.io** to discuss corporate sponsorship tiers.

> Sponsorship funds are used exclusively for project infrastructure. No funds are used for proprietary development — the project will always remain Apache-2.0 licensed.

---

## 📄 License

Licensed under the **[Apache License, Version 2.0](LICENSE)**.

Copyright © 2024–2026 AkreTrix and k8sUI Contributors.

> This project explicitly rejects all copyleft-licensed dependencies (GPL, AGPL, LGPL). Dependency license compliance is enforced automatically in CI via [`cargo-deny`](deny.toml) for Rust and `license-checker` for the Node/TypeScript frontend. See [CONTRIBUTING.md](CONTRIBUTING.md#3-dependency--license-policy) for the full policy.
