# UX Design Principles for k8sUI

k8sUI is built to provide rapid, fail-safe Kubernetes cluster management with high visual clarity and zero accidental destruction.

---

## 1. Core UX Principles

### 1. Persistent Context & Environment Color-Coding
- The active cluster connection, cloud provider (EKS, AKS, Local), and namespace switcher remain **persistently visible** in the top navigation bar.
- Clusters are color-coded by environment tier to prevent accidental commands against production:
  - **Production (`prod`, `prd`)**: High-visibility Crimson / Red accent border and badge.
  - **Staging / QA (`stage`, `staging`, `qa`)**: Amber / Yellow accent.
  - **Development / Local (`dev`, `local`, `kind`, `minikube`)**: Emerald / Slate Blue accent.

### 2. Read-Only Default with Fail-Safe Write Mode
- Every new cluster session defaults to **Read-Only Mode** (:lock:).
- Mutating operations (scaling, editing, deleting) are disabled until the user explicitly unlocks write mode.
- Switching to Write Mode on a `production` cluster requires a confirmation modal.

### 3. Command Palette (Cmd/Ctrl + K)
- Global keyboard-first navigation for switching clusters, jumping to namespaces, filtering resources, and opening tools.

### 4. Mandatory Dry-Run Diff Views
- Any manifest apply or replica scale operation displays a unified/side-by-side diff comparing the live cluster state against the proposed changes before committing.

### 5. Progressive Disclosure
- Standard view presents clean, high-density resource tables and essential metrics.
- Advanced features (raw YAML inspector, container terminal exec, port-forwarding tunnels) are placed behind explicit "Advanced" toggles.

### 6. Streaming Status & Keyboard Accessibility
- Resource status indicators (Running, CrashLoopBackOff, Pending, Error) are updated in real-time via Kubernetes watch streams (no manual polling needed).
- Full keyboard navigation (Vim-style `j`/`k` or arrow keys, `/` to filter, `Enter` to inspect, `Esc` to close modals) and ARIA screen-reader labels.
