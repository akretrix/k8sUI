# Security Policy & Vulnerability Reporting

The k8sUI team takes the security of our application and the Kubernetes clusters it manages very seriously.

---

## 1. Supported Versions

| Version | Supported |
| :--- | :--- |
| `0.1.x` (Current development) | :white_check_mark: |
| `< 0.1.0` | :x: |

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability in k8sUI, please **do not open a public GitHub issue**.

Instead, please report security vulnerabilities via one of the following methods:
1. **GitHub Private Vulnerability Reporting**: Submit a confidential advisory directly under the **Security** tab of the repository.
2. **Email Security Team**: Send an encrypted or confidential email to `security@k8sui.dev` (or the maintainer contact listed in GitHub).

### What to Include in Your Report
- A clear description of the vulnerability and attack scenario.
- Steps to reproduce, Proof-of-Concept (PoC) code or screenshots.
- Target platform details (macOS / Linux / Windows) and cluster type (EKS, AKS, Local).
- Any proposed remediation or patch.

---

## 3. Response SLAs
- **Initial Acknowledgment**: Within 48 hours.
- **Triage & Severity Assessment**: Within 5 business days.
- **Fix & Advisory Release**: Coordinated disclosure with CVE issuance within 30 days depending on severity.

---

## 4. Security Architecture & Anti-Patterns Reference
- **Threat Model (STRIDE)**: [`THREAT_MODEL.md`](THREAT_MODEL.md)
- **Security Anti-Patterns & Prohibitions ("What to Avoid")**: [`anti-patterns-and-prohibitions.md`](anti-patterns-and-prohibitions.md)
- **AI Safety & Redaction Policy**: [`ai-safety.md`](ai-safety.md)
- **Dependency & Licensing Policy**: [`dependency-policy.md`](dependency-policy.md)
- **Security Scanning Matrix**: [`security-scanning-matrix.md`](security-scanning-matrix.md)
