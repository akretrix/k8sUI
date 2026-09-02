# ADR 0001: Adopting Apache-2.0 License and Developer Certificate of Origin (DCO)

## Status
Accepted

## Context
k8sUI is an open-source, enterprise-grade, multiplatform desktop application for managing Kubernetes clusters across multi-cloud (AWS EKS, Azure AKS) and local environments. Managing infrastructure and sensitive credentials requires high trust from individual developers, platform engineers, and enterprise organizations.

When choosing a license and contribution framework, we needed to balance:
1. **Permissiveness and Adoption**: Enabling individuals and enterprises to use, inspect, build upon, and integrate k8sUI without copyleft friction.
2. **Explicit Patent Grants**: Protecting downstream users and contributors against patent infringement claims arising from contributed code.
3. **Trademark Protection**: Ensuring the project's identity and brand cannot be misused by third-party redistributions.
4. **Contribution Friction**: Balancing legal rigor for inbound code with minimal barrier to entry for community contributors (avoiding heavy Corporate Contributor License Agreements [CLAs] that require manual signature management, company approvals, and legal friction).

## Decision
1. **License**: We license k8sUI under the **Apache License, Version 2.0** (`Apache-2.0`).
2. **Contribution Model**: We require all contributions to adhere to the **Developer Certificate of Origin (DCO)** via `git commit -s` (`Signed-off-by:` trailers), rather than requiring a proprietary or centralized CLA.
3. **Dependency Compliance**: Every project dependency in Rust (`Cargo.toml`) and TypeScript/Node (`package.json`) must have an OSI-approved license compatible with Apache-2.0 (e.g., Apache-2.0, MIT, BSD-2-Clause, BSD-3-Clause, ISC). Dependencies under copyleft licenses without explicit desktop application linking exceptions (such as GPL-2.0, GPL-3.0, AGPL-3.0) are strictly banned and enforced via automated CI gates (`cargo-deny` and `license-checker`).

## Consequences

### Positive
- **Enterprise-Friendly**: The Apache-2.0 license includes an explicit patent license grant (Section 3) and patent termination clause, providing clear legal certainty for cloud platform adoption.
- **Low Contribution Overhead**: DCO allows any developer to certify code provenance using standard Git tooling (`git commit -s`), removing the barrier of third-party CLA bots or legal department approvals.
- **Trademark Protection**: Explicit preservation of trademark rights prevents deceptive third-party derivative builds.
- **Automated Verification**: DCO compliance can be verified automatically via GitHub Actions on every pull request.

### Negative / Trade-offs
- **Enforcement Overhead**: CI must maintain strict automated gates (`cargo-deny` and npm license linters) to ensure transitive dependencies never introduce incompatible licenses.
- **Permissive Derivatives**: Third parties may distribute closed-source derivatives as long as they preserve copyright, NOTICE, and license attributions.
