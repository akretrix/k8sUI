# k8sUI STRIDE Threat Model

This document outlines the security architecture and STRIDE threat analysis for **k8sUI**.

---

## 1. Threat Matrix (STRIDE)

| Threat Category | Specific Threat Scenario | Impact | Severity | Mitigation in k8sUI |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Compromised Release Artifact / Fake Installer | Attacker distributes trojanized k8sUI desktop binaries. | Critical | Release artifacts are signed using **Sigstore / Cosign** via OIDC keyless signing, with CycloneDX SBOMs attached to every GitHub release. |
| **Spoofing** | Cluster Impersonation / TLS MITM | Rogue proxy intercepts cluster API traffic. | Critical | Strict TLS certificate validation enforced in `kube-rs` using cluster CA bundles from kubeconfig or cloud IAM; insecure TLS skipping is disabled by default and flagged with high-visibility warnings. |
| **Tampering** | Local Plaintext Kubeconfig / Token Theft | Malware reads static tokens stored in plaintext on disk. | High | **Zero static credentials** written to disk. Cloud tokens are short-lived (15-min STS / Azure AD) kept strictly in volatile memory. Sensitive preferences stored in OS Keyring / SQLCipher. |
| **Tampering** | Accidental / Rogue Cluster Mutation | User or AI inadvertently alters/deletes production resources. | High | Clusters default to **Read-Only Mode**. Every mutation requires **Server-side Dry-Run Diff Confirmation** modal before execution. |
| **Repudiation** | Denied Privileged Action | Unauthorized or disputed cluster mutation without accountability. | Medium | Built-in, local, tamper-evident **Audit Log** recording user, timestamp, target cluster, action, manifest diff, and AI/manual origin tag. |
| **Information Disclosure** | Credential Leakage via Logs / AI Context | Secrets or tokens exposed in application logs or AI prompt streams. | High | Automated **Redaction Engine** scrubs Secret keys, Bearer tokens, and AWS/Azure credentials before writing logs or dispatching prompts to LLM providers. |
| **Denial of Service** | Watch Stream / Polling Exhaustion | Excessive cluster polling degrades API server performance. | Medium | Direct asynchronous **Kubernetes Watch Streams** via Tokio channels; zero aggressive polling loops. |
| **Elevation of Privilege** | Malicious Plugin / XSS to Native RCE | Exploiting web frontend to gain host shell access. | Critical | **Tauri Sandboxed WebView** without Node.js runtime. Scoped Tauri capability allowlist. Strict Content Security Policy (CSP). |
| **Elevation of Privilege** | Indirect AI Prompt Injection | Malicious resource names/logs trick LLM into executing destructive actions. | High | **Tool Whitelist Only** (5 fixed tools). Cluster data treated as untrusted context. **Mandatory Human-in-the-Loop Confirmation** for all mutating tools. |
