# Contributing to k8sUI

Thank you for your interest in contributing to **k8sUI**! We are building a secure, open-source, multiplatform Kubernetes desktop manager. Because this application interacts with mission-critical cloud infrastructure and sensitive credentials, security, supply-chain integrity, and code provenance are top priorities.

---

## Table of Contents

1. [Developer Certificate of Origin (DCO)](#1-developer-certificate-of-origin-dco)
2. [Security & Architecture Guidelines](#2-security--architecture-guidelines)
3. [Dependency & License Policy](#3-dependency--license-policy)
4. [Pull Request Process](#4-pull-request-process)
5. [Reporting Security Vulnerabilities](#5-reporting-security-vulnerabilities)

---

## 1. Developer Certificate of Origin (DCO)

We do **not** require a heavy Corporate Contributor License Agreement (CLA). Instead, all contributions to k8sUI must comply with the **Developer Certificate of Origin (DCO) Version 1.1**.

### What is the DCO?

The DCO is a simple statement you make with every commit. By signing off, you are certifying — in plain terms — that:

- **You wrote this code yourself**, or you have the legal right to contribute it under the project's open-source license.
- **You are not sneaking in third-party code** that you don't have permission to contribute.
- **You understand this is a permanent public record.** The commit, including your sign-off, will remain part of the project's history.

That's it. No lawyers, no paperwork. Just a trailer line on your commit.

### DCO Text (Version 1.1)

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it; and

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

### How to Sign Off Your Commits

Use the `-s` (or `--signoff`) flag when committing:

```bash
git commit -s -m "feat(connector): add STS token caching"
```

This automatically appends a trailer with your configured Git name and email:

```
Signed-off-by: Jane Doe <jane.doe@example.com>
```

> **Make sure your Git name and email match your identity.** Git reads these from `user.name` and `user.email` in your Git config:
> ```bash
> git config --global user.name "Jane Doe"
> git config --global user.email "jane.doe@example.com"
> ```

### Forgot to Sign Previous Commits?

If you already pushed commits without sign-offs, you can retroactively sign them during an interactive rebase:

```bash
# Sign all commits on your branch since branching from main
git rebase -i --signoff origin/main
```

### CI Enforcement

The `dco-check` CI job in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) automatically verifies that **every commit in a pull request** carries a valid `Signed-off-by:` trailer. PRs with unsigned commits will fail CI and cannot be merged.

---

## 2. Security & Architecture Guidelines

When submitting pull requests, follow these core security tenets. Violations will cause CI failure or PR rejection on review:

1. **No `kubectl` Subprocesses** — Never shell out to the `kubectl` CLI for any core operation. All cluster interactions (list, watch, get, apply, logs, exec, port-forward) must use [`kube-rs`](https://kube.rs) directly over native TLS.

2. **Credential Isolation** — The React frontend must never handle raw cloud secrets or tokens. All authentication state is scoped and held strictly within the Rust core connector layer. Do not add any token or credential handling to frontend code.

3. **Official SDKs Only for Auth** — AWS authentication must use only `aws-sdk-sts`, `aws-config`, and `aws-sigv4`. Azure authentication must use only `azure_identity`. Third-party or community auth crates are not permitted.

4. **No Default-On Telemetry** — Dependencies that phone home or collect analytics by default are rejected, regardless of their license.

5. **Read-Only Default** — New features that perform write or mutating operations must respect the global Read-Only mode flag and must not bypass the dry-run diff flow.

---

## 3. Dependency & License Policy

k8sUI is licensed under **Apache-2.0**. To maintain license compatibility across the entire dependency tree, we enforce a strict dependency policy.

### ✅ Allowed Licenses

Only OSI-approved licenses that are compatible with Apache-2.0 are permitted:

| License | SPDX Identifier |
| :--- | :--- |
| Apache License 2.0 | `Apache-2.0` |
| MIT License | `MIT` |
| BSD 2-Clause | `BSD-2-Clause` |
| BSD 3-Clause | `BSD-3-Clause` |
| ISC License | `ISC` |
| Zero-Clause BSD | `0BSD` |
| Unlicense | `Unlicense` |
| zlib License | `Zlib` |
| Unicode DFS 2016 | `Unicode-DFS-2016` |

### ❌ Prohibited Licenses

**Copyleft licenses are strictly banned.** The following licenses — and any others that impose copyleft obligations — are prohibited and will be automatically rejected by CI:

| License | SPDX Identifier | Reason |
| :--- | :--- | :--- |
| GNU GPL v1 / v2 / v3 | `GPL-1.0`, `GPL-2.0`, `GPL-3.0` | Strong copyleft — incompatible with Apache-2.0 |
| GNU Affero GPL v1 / v3 | `AGPL-1.0`, `AGPL-3.0` | Network-copyleft — incompatible |
| GNU Lesser GPL v2 / v2.1 / v3 | `LGPL-2.0`, `LGPL-2.1`, `LGPL-3.0` | Copyleft — incompatible without static-linking exception |
| Server Side Public License | `SSPL-1.0` | Not OSI-approved, deemed copyleft |
| Business Source License | `BUSL-1.1` | Not open-source |

### CI Enforcement

License compliance is enforced automatically on every pull request by two CI gates that **will block merging** if violations are found:

**Rust (cargo-deny):**

The [`deny.toml`](deny.toml) file is used by `cargo-deny` in the `rust-security` CI job. It allows only the licenses listed above and explicitly denies all copyleft identifiers. Any new Rust dependency with an incompatible license will cause the `cargo deny check` step to fail.

```bash
# Run locally before pushing
cargo deny check --config deny.toml
```

**Node.js / TypeScript (license-checker):**

The `frontend-security` CI job runs `npx license-checker` against production dependencies to verify all npm packages carry only allowed licenses. Any package with a GPL, AGPL, or other incompatible license will fail the check.

```bash
# Run locally before pushing
npx license-checker --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD;Unlicense" --production --summary
```

> **If you need a dependency with an unlisted license**, open a GitHub issue before your PR to discuss it. Do not add the dependency and request an exception after the fact.

---

## 4. Pull Request Process

1. **Fork** the repository and create a descriptive branch:
   ```bash
   git checkout -b feature/eks-oidc-connector
   # or
   git checkout -b fix/crd-discovery-timeout
   ```

2. **Run all local checks** before pushing:
   ```bash
   # Frontend
   pnpm run lint
   pnpm test
   pnpm run build

   # Rust backend
   cargo fmt --all --check --manifest-path src-tauri/Cargo.toml
   cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
   cargo test --manifest-path src-tauri/Cargo.toml
   cargo deny check --config deny.toml
   ```

3. **Sign every commit** with `-s`:
   ```bash
   git commit -s -m "feat(sidebar): group CRDs by API group"
   ```

4. **Submit your PR** against `main`. All CI jobs must pass before a maintainer will review.

5. **Respond to review feedback** — maintainers may request changes for security, performance, or license compliance reasons.

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

Signed-off-by: Jane Doe <jane.doe@example.com>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`.

---

## 5. Reporting Security Vulnerabilities

Please **do not** open public GitHub issues for security vulnerabilities. Doing so discloses the vulnerability before a patch is available.

Review our [Security Policy](SECURITY.md) for instructions on responsible, confidential disclosure. We aim to acknowledge reports within 48 hours and provide a fix timeline within 7 days for critical issues.
