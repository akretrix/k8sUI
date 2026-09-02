# Dependency and Supply Chain Security Policy

This document outlines the strict rules governing third-party dependencies in **k8sUI**.

---

## 1. Approved Libraries & Frameworks

### Rust Core
- **Kubernetes Client**: `kube` (with `ws`, `terminal`, `runtime` features) and `k8s-openapi` (v1_30).
- **Cloud Authentication**:
  - AWS: Official `aws-sdk-sts`, `aws-config`, `aws-sigv4` crates only.
  - Azure: Official `azure_identity` crate only.
- **Desktop Shell**: `tauri` (v2), `tauri-plugin-dialog`.
- **Async Runtime**: `tokio` (with full features).
- **Serialization**: `serde`, `serde_json`, `serde_yaml`.
- **Logging & Tracing**: `tracing`, `tracing-subscriber`.
- **Error Handling**: `thiserror`, `anyhow`.
- **Local Secure Storage**: `keyring`, `rusqlite` (with `sqlcipher` encrypted feature).

### Frontend UI
- **Framework**: `react`, `react-dom`, `vite`.
- **Styling**: `tailwindcss`, `clsx`, `tailwind-merge`, `lucide-react`, `@tabler/icons-react`.
- **State & Tables**: `@tanstack/react-query`, `@tanstack/react-table`.
- **Terminal Emulator**: `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`.

---

## 2. Hard Bans & Prohibitions

1. **The `kubectl` Subprocess Rule**:
   - Spawning `kubectl` (or any CLI wrapper binary) for core features (list, watch, get, apply, logs, exec, port-forward) is **strictly banned**.
   - Direct API calls via `kube-rs` over TLS must be used exclusively.
2. **Unofficial Cloud Auth Wrappers**:
   - Third-party or unverified crates purporting to wrap AWS STS or Azure AD authentication are prohibited. Only official vendor SDKs are permitted.
3. **Copyleft Without Linking Exceptions**:
   - Dependencies licensed under `GPL-1.0/2.0/3.0`, `AGPL-1.0/3.0`, `LGPL`, `SSPL`, or `BUSL` are prohibited and blocked by `cargo-deny`.
4. **Telemetry & Phoning Home**:
   - Any dependency containing default-on telemetry or background analytics is prohibited.
5. **Dynamic Code Execution (`eval`)**:
   - Any dynamic code evaluation (`eval()`, `new Function()`) in frontend code is prohibited.

---

## 3. Dependency Vetting Checklist for PRs

Before adding a new dependency:
- [ ] Is the license Apache-2.0 compatible?
- [ ] Is the crate maintained by a recognized organization or established maintainer?
- [ ] Does it introduce unnecessary transitive dependencies?
- [ ] Does `cargo-deny check` and `npx license-checker` pass cleanly in CI?
- [ ] Does `npm audit` / `cargo audit` report zero high or critical vulnerabilities?
