# Local Development & Environment Setup Guide

This guide describes the hardware, OS, and toolchain requirements for developing and running **k8sUI** locally.

---

## 1. System Requirements & Toolchain Matrix

| Component | Minimum Version | Recommended / Latest Stable | Purpose |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v20.0.0` (LTS) | `v20.x` or `v22.x` (Current LTS) | Frontend bundling & Vite dev server |
| **Package Manager** | `npm v10+` or `pnpm v9+` | `pnpm v9.6+` or `npm v10.8+` | Dependency management |
| **Rust Compiler** | `1.78.0` | `1.80.0+` (Latest Stable) | Tauri desktop core compilation |
| **Cargo** | `1.78.0` | `1.80.0+` | Rust package manager |
| **Kubernetes Client** | `kube-rs v0.93` | `kube v0.93` + `k8s-openapi v0.22` | Native cluster API client |

---

## 2. OS-Specific Prerequisites

### macOS (Apple Silicon & Intel)
1. **Xcode Command Line Tools**:
   ```bash
   xcode-select --install
   ```
2. **Rust Toolchain**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
3. **Node.js**:
   Install via Homebrew:
   ```bash
   brew install node pnpm
   ```

### Linux (Ubuntu / Debian / Fedora)
1. **System Libraries & WebKitGTK**:
   * Ubuntu/Debian:
     ```bash
     sudo apt update
     sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev
     ```
   * Fedora:
     ```bash
     sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget libappindicator-gtk3-devel librsvg2-devel
     ```
2. **Rust & Node.js**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   sudo apt install -y nodejs npm
   ```

### Windows 10 / 11
1. **Visual Studio C++ Build Tools**:
   Install Visual Studio 2022 with **"Desktop development with C++"** workload.
2. **WebView2 Runtime**: Included with Windows 10/11 by default.
3. **Rust Toolchain**:
   Download and run `rustup-init.exe` from [rustup.rs](https://rustup.rs).

---

## 3. Quick Launch Options

### Option A: One-Command Interactive Launcher (Recommended)
Run our automated diagnostics and launch manager:
```bash
./scripts/launch-local.sh
```
or via pnpm:
```bash
pnpm launch
```

### Option B: Browser Dev Mode (Instant UI Development)
Runs the React + Vite frontend with the built-in mock cluster provider (perfect for UI/UX iterations without compiling Rust):
```bash
pnpm dev
# Open http://localhost:5173
```

### Option C: Native Desktop Mode (Full Tauri App)
Compiles the Rust core and runs the native desktop window connected to local kubeconfig:
```bash
pnpm tauri dev
```

---

## 4. Stability & Version Verification

k8sUI's dependencies are locked to the **latest stable, audited releases**:

| Dependency | Configured Version | Stability Status |
| :--- | :--- | :--- |
| `react` / `react-dom` | `^18.3.1` | Latest stable production release |
| `vite` | `^8.2.2` | Latest stable bundler (zero security vulnerabilities) |
| `@tanstack/react-query` | `^5.51.1` | Latest stable v5 query cache |
| `@tanstack/react-table` | `^8.19.3` | Latest stable v8 headless table |
| `@xterm/xterm` | `^5.5.0` | Latest stable xterm engine |
| `tailwindcss` | `^3.4.7` | Stable CSS utility engine |
| `tauri` (v2) | `2.0.0` | Latest stable release with granular capabilities |
| `aws-sdk-sts` | `1.34` | Official stable AWS SDK |
| `azure_identity` | `0.20` | Official stable Azure SDK |
| `kube` | `0.93` | Official stable Rust Kubernetes API client |
