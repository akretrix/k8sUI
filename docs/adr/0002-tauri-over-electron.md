# ADR 0002: Tauri Over Electron for Desktop Shell Architecture

## Status
Accepted

## Context
Desktop Kubernetes management tools must handle sensitive cloud tokens, kubeconfigs, and continuous streaming connections (logs, watches, exec sessions, port-forwarding).

Historically, cross-platform desktop applications have heavily relied on Electron. However, Electron introduces significant architectural and security challenges:
1. **Large Attack Surface**: Electron bundles a complete Chromium browser engine and Node.js runtime inside the frontend renderer process, making context isolation leaks and Remote Code Execution (RCE) via XSS vulnerabilities a severe risk.
2. **Resource Consumption**: Bundling Chromium and Node.js leads to heavy idle memory consumption (often 200MB–500MB+ per window) and large binary installer sizes (>100MB).
3. **Privilege Separation**: Enforcing a strict boundary where frontend UI JavaScript has zero direct access to filesystem, OS keychains, or network sockets requires complex, custom IPC boilerplate in Electron.
4. **Systems-Level Native Integration**: Connecting to secure platform storage (macOS Keychain, Windows DPAPI, Linux Secret Service) and high-throughput streaming over Kubernetes websockets is far safer and more performant in a compiled systems language.

## Decision
We select **Tauri (v2)** with a **Rust core** and native platform WebViews (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux), explicitly rejecting Electron.

Key architectural boundaries:
- **Rust App Core**: All cluster communication, authentication token generation, credential storage, and Kubernetes websocket handling live in Rust.
- **Frontend Isolation**: The React/TypeScript frontend operates strictly inside a sandboxed WebView with no direct Node.js runtime, zero filesystem access, and strict Content Security Policy (CSP).
- **Capability Allowlisting**: Frontend calls into the Rust core exclusively via strongly typed Tauri IPC commands scoped under explicit capability manifests.
- **Native OS Security**: Secure key storage utilizes native OS keyrings (via Rust `keyring` crate) instead of storing secrets in renderer memory or plaintext files.

## Consequences

### Positive
- **Reduced Attack Surface**: No bundled Node.js runtime in the renderer; XSS attacks cannot directly spawn subprocesses or access files.
- **Lightweight Footprint**: Binary size is under 15MB, and idle RAM consumption is drastically lower (typically 30–60MB) compared to Electron.
- **Memory Safety & Concurrency**: Rust's ownership model guarantees memory safety and thread safety for async streaming (watches, port-forwarding, exec websockets).
- **Security Capabilities**: Tauri v2 capability files explicitly declare and limit which IPC commands each window can invoke.

### Negative / Trade-offs
- **WebView Divergence**: Requires testing across different OS WebViews (WebKit vs WebView2 vs WebKitGTK), though modern web standards and Vite/Tailwind minimize styling discrepancies.
- **Rust Toolchain Requirement**: Building the native backend requires a Rust compiler toolchain and platform C/C++ build tools.
