# Security Scanning & Automated Verification Matrix

To ensure defense-in-depth for **k8sUI**, automated security scans must be enforced across four distinct checkpoints: **Pre-commit**, **Pull Request CI**, **Release Pipeline**, and **Application Runtime**.

---

## 1. Security Scan Taxonomy & Tooling Matrix

| Security Layer | Scan Type | Target / Scope | Recommended Tool | Execution Phase |
| :--- | :--- | :--- | :--- | :--- |
| **Secret Scanning** | Hardcoded Credential Detection | Git commits, PR diffs, environment files | **Gitleaks** / **TruffleHog** | Pre-commit & PR CI |
| **SAST (Rust)** | Static Code Analysis & Unsafe Audit | Rust core logic, memory safety, unsafe blocks | **`cargo clippy`** (`-D warnings`) & **`cargo geiger`** | PR CI |
| **SAST (Frontend)** | Static Analysis & XSS Prevention | React / TypeScript source code, DOM handling | **ESLint** (`eslint-plugin-security`) & **Semgrep** | PR CI |
| **SCA (Rust)** | Dependency Vulnerability & License Audit | `Cargo.lock` dependencies & advisories | **`cargo-deny`** & **`cargo-audit`** (RustSec) | PR CI |
| **SCA (Frontend)** | Dependency Vulnerability & License Audit | `package-lock.json` dependencies & licenses | **`npm audit`** & **`license-checker`** | PR CI |
| **Filesystem / Repo** | Comprehensive CVE Scanner | Workspace files, embedded assets, lockfiles | **Aqua Trivy** & **Anchore Grype** | PR CI & Scheduled |
| **Binary Auditing** | Embedded Dependency Metadata | Compiled desktop executables (`.app`, `.exe`) | **`cargo-auditable`** | Release Pipeline |
| **Binary Hardening** | ASLR, DEP/NX, Stack Canaries, PIE | Compiled native binaries | **`checksec`** / **`cargo-bloat`** | Release Pipeline |
| **Supply Chain (SBOM)** | Software Bill of Materials (CycloneDX) | Rust + Node dependency graphs | **`cargo-cyclonedx`** & **`@cyclonedx/cyclonedx-npm`** | Release Pipeline |
| **Supply Chain (Sign)** | Cryptographic Attestation & Signing | Release binaries, installers, SBOMs | **Sigstore / Cosign** (Keyless OIDC) | Release Pipeline |
| **Supply Chain (SLSA)** | Build Provenance & OpenSSF Scorecard | CI pipeline, GitHub repository posture | **SLSA GitHub Generator** & **OpenSSF Scorecard** | Release Pipeline |
| **Fuzz Testing** | ANSI, Manifest Parsing, Redaction Engine | String parser, ANSI escapes, Redaction regex | **`cargo-fuzz`** (libFuzzer) | Nightly CI |
| **AI Red-Teaming** | Prompt Injection & Jailbreak Fuzzing | AI Copilot prompts, tool whitelist filters | **Promptfoo** / **Garak** (LLM Red-Team) | Nightly CI |
| **Runtime Redaction** | Credential Leak Prevention in Logs/Context | In-memory strings, cluster logs, manifests | **k8sUI Built-in `RedactionEngine`** | App Runtime |

---

## 2. Detailed Scan Implementations

### A. Secret Scanning (`Gitleaks`)
- **Purpose**: Prevent developers from accidentally committing AWS access keys (`AKIA...`), Azure client secrets, private keys, or Kubernetes bearer tokens.
- **Rule Configuration**:
  - AWS Access Keys & STS session tokens
  - Azure Tenant & Client secrets
  - Kubernetes service account tokens
  - Generic high-entropy private keys (`RSA`, `EC`, `OPENSSH`)

### B. Static Application Security Testing (SAST)
- **Rust Core**:
  ```bash
  cargo clippy --all-targets --all-features -- -D warnings -D clippy::undocumented_unsafe_blocks
  cargo geiger --manifest-path src-tauri/Cargo.toml # Flags all unsafe blocks in dependencies
  ```
- **TypeScript Frontend**:
  - `eslint-plugin-security`: Detects non-literal regexes, unsafe object lookups, and prototype pollution.
  - `Semgrep` rules to block `dangerouslySetInnerHTML`, `eval()`, `new Function()`, and raw IPC bypasses.

### C. Software Composition Analysis (SCA) & License Compliance
- **`cargo-deny`**: Enforces strict allowlist of OSI licenses (`Apache-2.0`, `MIT`, `BSD`, `ISC`), denies copyleft (`GPL`/`AGPL`/`LGPL`), and blocks yanked or vulnerable crates from the RustSec Advisory Database.
- **`license-checker`**: Enforces identical license whitelist on all npm production packages.

### D. Binary Security: `cargo-auditable`
- Compiles the Rust binary with an `.auditable.cargo` ELF/Mach-O section containing the full verified dependency tree.
- Allows security tools (like Trivy or Grype) to scan the **released `.dmg`, `.exe`, or `.deb` installer** directly for CVEs without needing access to the original source code repository.

### E. Supply Chain Attestation: Sigstore Cosign & CycloneDX SBOM
- Generates compliant **CycloneDX v1.5 JSON SBOMs** capturing both Rust crates and npm packages.
- Signs release binaries and SBOMs keylessly using GitHub Actions OIDC identity via **Sigstore / Cosign**.
- Generates **SLSA Level 3** build provenance attestations.

### F. AI Safety & Prompt Injection Scans (Promptfoo / Garak)
- Executes automated prompt injection test suites against the Copilot prompt templates:
  - **Indirect Prompt Injection**: Simulates malicious error logs with embedded instruction override strings.
  - **Exfiltration Attempts**: Tests if the model can be tricked into outputting base64-encoded secrets.
  - **Parameter Validation**: Tests if malformed namespace or pod names containing shell metacharacters (`$(...)`, `;`, `&&`) are correctly blocked by input validators.
