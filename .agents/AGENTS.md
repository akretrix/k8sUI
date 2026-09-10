# AKRETRIX K8SUI AGENT RULES & ARCHITECTURE

## Golden Policies (Strictly Enforced)

### 1. Package Manager
- ALWAYS use `pnpm`. Never `npm` or `yarn`.
- Scripts: `pnpm install`, `pnpm test --run`, `pnpm run check:security`, `pnpm exec tsc --noEmit`

### 2. Git Policy
- NEVER run `git commit`, `git push`, or alter git history. Leave all commits to the user.

### 3. Cloud / Cluster Safety
- All K8s / AWS / GCP / Azure interactions must be **strictly read-only** (`get`, `describe`, `list`, `logs`).
- Never scale, delete, terminate, or apply destructive changes to remote clusters.

### 4. Write-Mode Safety (UI)
- All mutating UI actions must check `isReadOnly` before triggering.
- All destructive or mutating actions must go through `ConfirmationModal` with a typed `actionType`.

---

## Tech Stack
| Layer | Technology |
|---|---|
| Desktop runtime | Tauri v2 (Rust, `src-tauri/`) |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 |
| Icons | Lucide React |
| Data fetching | TanStack React Query v5 |
| State | React hooks + Zustand (lightweight) |
| Testing | Vitest + React Testing Library |
| Security scan | `pnpm run check:security` (8 checks: gitleaks, cargo fmt, clippy, cargo deny, licenses, pnpm audit, tsc, akretrix-sec) |

---

## Project File Map

```
k8sUI/
├── src-tauri/
│   ├── src/
│   │   ├── commands/mod.rs        # Tauri IPC command handlers (invoke_handler registration)
│   │   ├── core/resource_manager.rs  # K8s API calls, resource CRUD, CronJob/Job batch ops
│   │   └── lib.rs                 # .invoke_handler([...]) — register commands here
│   └── Cargo.toml
├── src/
│   ├── App.tsx                    # Root: all state, mutations, modal wiring, GenericResourceTable props
│   ├── api/tauriClient.ts         # Frontend API bridge (invoke wrappers + mockClient for tests)
│   ├── types/cluster.ts           # Shared TypeScript types (PodSummary, Resource, etc.)
│   ├── utils/
│   │   ├── ansiRenderer.tsx       # ANSI escape → React spans parser
│   │   └── k8sResources.ts        # CPU/Memory formatting helpers
│   └── components/
│       ├── common/
│       │   ├── GenericResourceTable.tsx  # Main K8s resource table (columns, actions, CronJob/Job buttons)
│       │   ├── DescribeModal.tsx         # Detail/inspect panel (toolbar + overview tab per kind)
│       │   ├── ConfirmationModal.tsx     # Confirmation dialog (actionType-driven copy + callbacks)
│       │   ├── LogsView.tsx             # Log streaming panel (search, scroll-jump, text-selection)
│       │   ├── YamlEditorModal.tsx      # YAML editor + apply
│       │   └── ScaleModal.tsx           # Scale replicas modal
│       ├── layout/
│       │   ├── BottomPanel.tsx    # Tab-based bottom panel (logs, exec, port-forward tabs)
│       │   ├── Sidebar.tsx        # Left nav (resource kind selector)
│       │   ├── Header.tsx         # Top bar (cluster info, read-only toggle, AI button)
│       │   └── NewTabModal.tsx    # New tab resource picker
│       ├── cluster/
│       │   ├── ClusterSwitcher.tsx
│       │   └── ReadOnlyToggle.tsx
│       ├── terminal/TerminalView.tsx  # xterm.js SSH/exec terminal
│       └── helm/HelmUpgradeModal.tsx
```

---

## Key Patterns

### Adding a new Tauri command
1. Implement logic in `src-tauri/src/core/resource_manager.rs`
2. Add `#[tauri::command]` handler in `src-tauri/src/commands/mod.rs` (guard with `is_read_only`)
3. Register in `src-tauri/src/lib.rs` → `.invoke_handler(tauri::generate_handler![..., new_cmd])`
4. Add typed wrapper + mock in `src/api/tauriClient.ts`
5. Wire mutation in `App.tsx`, pass handler as prop to `GenericResourceTable` and/or `DescribeModal`

### Adding a new resource action (UI)
1. Add `actionType` to `ConfirmationModal.tsx` (copy text + confirm callback)
2. Add column/button in `GenericResourceTable.tsx` (guard with `isReadOnly`)
3. Add toolbar button in `DescribeModal.tsx` (guard with `isReadOnly`)
4. Add mutation in `App.tsx`, wire props to both table and modal
5. Add overview card in `DescribeModal.tsx` Overview tab if the kind needs metrics

### DescribeModal kind detection (normalizedKind)
```ts
const isCronJob = ['cronjob', 'cronjobs', 'cj'].includes(normalizedKind);
const isJob     = !isCronJob && ['job', 'jobs'].includes(normalizedKind);
const isHelmRelease = ['helm', 'helmrelease', ...].includes(normalizedKind);
const isNode    = ['node', 'nodes'].includes(normalizedKind);
const isService = ['service', 'services'].includes(normalizedKind);
```

### ConfirmationModal actionTypes (complete list as of 2026-09-10)
`delete`, `restart`, `trigger_job`, `suspend_cronjob`, `resume_cronjob`, `rerun_job`, `suspend_job`, `resume_job`

### API bridge pattern (tauriClient.ts)
```ts
// Real Tauri call
triggerCronJob: (ns, name) => invoke('trigger_cronjob', { namespace: ns, name }),
// Mock for tests
triggerCronJob: async () => {},
```

---

## Testing
- Run: `pnpm test --run` (22 test files, 164 tests as of 2026-09-10)
- Key suites: `NavigationAndDescribeSuite.test.tsx`, `GenericResourceTable.test.tsx`, `ModalsAndActionsSuite.test.tsx`
- Always run `pnpm exec tsc --noEmit` before declaring done
- Security gate: `pnpm run check:security` (must pass all 8 checks before push)

