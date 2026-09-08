# AKRETRIX K8SUI AGENT RULES & ARCHITECTURE

## Golden Policies (Strictly Enforced)

### 1. Package Manager Policy
- **Standard:** ALWAYS use `pnpm` (`pnpm install`, `pnpm build`, `pnpm test`, etc.). Never use `npm` or `yarn`.

### 2. Git Commit & Push Policy
- **STRICTLY FORBIDDEN:** Never run `git commit`, `git push`, or modify git history.
- Always leave changes unstaged or staged in the working tree for manual user verification and commit.

### 3. Cloud & Infrastructure Safety Policy
- **STRICTLY READ-ONLY:** All interactions with AWS, GCP, Azure, or remote Kubernetes clusters MUST be read-only (`get`, `describe`, `list`, `logs`).
- **NO MUTATIONS:** Never scale down, terminate pods, delete namespaces, or apply unreviewed destructive manifests directly to remote clusters.

---

## k8sUI Technical Stack
- **Desktop Runtime:** Tauri v2 (Rust backend located in `src-tauri/`)
- **Frontend Core:** React 18 + TypeScript + Vite
- **Styling & Icons:** Tailwind CSS v3 + Lucide React icons
- **State Management & Querying:** TanStack React Query v5 + Zustand / React hooks
- **Testing Frameworks:** Vitest + React Testing Library + Playwright
