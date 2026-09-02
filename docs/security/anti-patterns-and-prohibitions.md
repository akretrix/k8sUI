# Security Anti-Patterns & Prohibitions Guide

This document defines the **prohibited practices, architectural anti-patterns, and security invariants** that must be strictly avoided across the entire lifecycle of **k8sUI** (codebase, CI/CD pipelines, desktop runtime, and cloud/cluster operations).

---

## 1. Cloud & Credential Anti-Patterns (AWS / Azure / Local)

```
┌──────────────────────────────────────────────────┐
│              CREDENTIAL HANDLING                 │
├─────────────────────────┬────────────────────────┤
│ ❌ PROHIBITED           │ ✅ ENFORCED STANDARD   │
├─────────────────────────┼────────────────────────┤
│ Static IAM Access Keys  │ AWS IAM Identity Center│
│ (AKIA...)               │ + Short-lived STS (15m)│
├─────────────────────────┼────────────────────────┤
│ Plaintext Tokens on Disk│ Volatile Memory &      │
│ (.env, config files)    │ OS Keyring (DPAPI/Sec) │
├─────────────────────────┼────────────────────────┤
│ SMS/Email-based OTP     │ Hardware FIDO2/Passkeys│
│ (Phishable)             │ (WebAuthn Bound)       │
├─────────────────────────┼────────────────────────┤
│ Long-lived sessions     │ 15m–60m STS Sessions   │
│ (> 8 hours)             │ with automatic refresh │
└─────────────────────────┴────────────────────────┘
```

### Prohibitions:
1. **NEVER create or store static AWS IAM User Access Keys (`AKIA...`)**:
   * *Why*: Static access keys never expire automatically and are the #1 cause of cloud account compromises via leaked `.env` files or git commits.
   * *Rule*: Use AWS IAM Identity Center (AWS SSO) and ephemeral STS role tokens (`GetCallerIdentity` / `AssumeRole`).
2. **NEVER write sensitive credentials or session tokens to plaintext disk files**:
   * *Why*: Any process running with user privileges can read files in `~/.config` or project directories.
   * *Rule*: Keep tokens in volatile RAM. Store only non-sensitive configuration (start URLs, region, cluster names) in local storage; encrypt refresh tokens via the OS Keyring.
3. **NEVER disable TLS certificate verification (`insecure-skip-tls-verify: true`)**:
   * *Why*: Disabling TLS validation allows Adversary-in-the-Middle (AiTM) certificate spoofing and plaintext inspection.
   * *Rule*: Always validate cluster CA certificates against the cluster CA bundle.

---

## 2. Cluster Mutation & Runtime Anti-Patterns

### Prohibitions:
1. **NEVER shell out to the `kubectl` CLI subprocess for core features**:
   * *Why*: Subprocess execution (`std::process::Command`) introduces shell argument injection risks, uncontrolled PATH hijack vectors, and fragile parsing bugs.
   * *Rule*: All cluster queries, mutations, exec websockets, and port-forwards MUST use native Rust crates (`kube-rs`, `k8s-openapi`).
2. **NEVER bypass the Server-Side Dry-Run Diff before applying mutations**:
   * *Why*: Direct mutations without diff reviews risk accidental cluster disruption (e.g. scaling a database StatefulSet to 0).
   * *Rule*: All manifest changes and scaling operations must first generate a dry-run diff (`DryRunResult`) and require explicit human confirmation.
3. **NEVER allow Write Operations when in Read-Only Safeguard Mode**:
   * *Why*: Production clusters require an intentional safeguard barrier against accidental clicks.
   * *Rule*: When switching to any cluster (especially `Production`), the session is automatically locked in Read-Only Mode. Mutating IPC commands (`apply_manifest`, `scale_resource`) must reject requests with an explicit error.

---

## 3. AI Copilot & LLM Safety Anti-Patterns

```
┌──────────────────────────────────────────────────┐
│                 AI COPILOT RULES                 │
├─────────────────────────┬────────────────────────┤
│ ❌ PROHIBITED           │ ✅ ENFORCED STANDARD   │
├─────────────────────────┼────────────────────────┤
│ Autonomous Execution    │ Human-in-the-loop      │
│ (Zero confirmation)     │ Dry-run Diff Approval  │
├─────────────────────────┼────────────────────────┤
│ Raw Secrets in Prompts  │ Automatic Regex        │
│ (Bearer tokens, TLS keys│ Redaction Engine       │
├─────────────────────────┼────────────────────────┤
│ Arbitrary Shell Tooling │ Strict 5-Tool Whitelist│
│ (bash/exec endpoints)   │ (ReadOnly + Scoped Mut)│
├─────────────────────────┼────────────────────────┤
│ Direct Execution of LLM │ Static Schema Validation│
│ Output Strings          │ via Serde Types        │
└─────────────────────────┴────────────────────────┘
```

### Prohibitions:
1. **NEVER grant autonomous cluster execution to AI models**:
   * *Why*: LLMs can hallucinate parameters or fall victim to prompt injection from untrusted log messages.
   * *Rule*: The AI layer is strictly advisory. Every proposed tool call requires human dry-run diff review before execution.
2. **NEVER transmit raw Kubernetes Secrets or TLS private keys to external AI providers**:
   * *Why*: Leaking cluster secrets or customer tokens to hosted LLM APIs violates compliance and enterprise data policies.
   * *Rule*: All context passed to AI must go through the `RedactionEngine` (`src-tauri/src/core/redact.rs`) to scrub tokens, private keys, and environment passwords.
3. **NEVER create arbitrary shell or terminal tools for AI**:
   * *Why*: Giving an LLM an open `exec_bash` tool allows prompt injections to run malicious commands.
   * *Rule*: The AI is restricted to a fixed 5-tool whitelist: `list_pods`, `describe_resource`, `get_logs`, `scale_deployment`, and `apply_manifest`.

---

## 4. Frontend & Desktop Shell Anti-Patterns (Tauri / React)

### Prohibitions:
1. **NEVER use `dangerouslySetInnerHTML`, `eval()`, or `new Function()`**:
   * *Why*: Renders the application vulnerable to Cross-Site Scripting (XSS) and remote code execution inside the WebView.
   * *Rule*: Use standard React JSX rendering and sanitize all terminal strings via `xterm.js`.
2. **NEVER use wildcards in Tauri IPC Capabilities**:
   * *Why*: Overly permissive capabilities allow malicious scripts to invoke sensitive OS APIs.
   * *Rule*: Define granular capability schemas in `src-tauri/capabilities/default.json`.
3. **NEVER use Electron**:
   * *Why*: Electron bundles a full Chromium/Node.js binary with higher attack surfaces and large memory footprints.
   * *Rule*: Use Tauri (Rust core + native OS WebKit/WebView2).

---

## 5. Supply Chain, Licensing & Governance Anti-Patterns

### Prohibitions:
1. **NEVER import GPL-3.0, AGPL-3.0, or SSPL licensed code or libraries**:
   * *Why*: Incompatible with the Apache-2.0 license and forces copyleft disclosure.
   * *Rule*: CI automatically enforces license policies via `cargo-deny` and `license-checker` (allowing only MIT, Apache-2.0, BSD-2/3, ISC).
2. **NEVER distribute unsigned desktop release binaries**:
   * *Why*: Downstream users and enterprises require cryptographic proof of authenticity.
   * *Rule*: All release binaries must have SHA256 checksums signed with **Sigstore / Cosign** and CycloneDX SBOMs attached.
3. **NEVER commit code without Developer Certificate of Origin (DCO) sign-off**:
   * *Why*: Ensures legal provenance and patent protection for all open-source contributions.
   * *Rule*: All git commits must include `Signed-off-by: Name <email>` via `git commit -s`.

---

## 6. Security Invariant Checklist for Developers

Before merging any code change, verify:
- [ ] No hardcoded passwords, tokens, or AWS credentials (`AKIA...`).
- [ ] No `std::process::Command::new("kubectl")` calls added.
- [ ] All new IPC commands enforce `is_read_only()` check for mutations.
- [ ] All new cluster operations log to `AuditLogger`.
- [ ] `npm run build` and `cargo test` pass with zero warnings.
- [ ] Commit is signed with `git commit -s`.
