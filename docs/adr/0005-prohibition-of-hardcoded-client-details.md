# ADR 0005: Strict Prohibition of Hardcoded Client Identifiers and Tenant Details

## Status
Accepted

## Context
`k8sUI` is an open-source, multi-tenant Kubernetes and cloud infrastructure administration desktop tool deployed across diverse customer environments and organizations. 

During local troubleshooting or feature development (such as AWS SSO Identity Center integration and EKS cluster discovery), developers or AI coding assistants might inadvertently insert client-specific names (e.g., specific SSO session names, client organization aliases, account numbers, or infrastructure ARNs) as fallbacks, defaults, or UI hints in source code.

This introduces severe risks:
1. **Confidentiality & Privacy Leakage**: Leaking client names, internal account numbers, or organization aliases in open source code or shared repositories violates NDAs and enterprise security compliance.
2. **Multi-Tenant Integrity**: Hardcoding client identifiers breaks the generic, multi-tenant capability of the application for all other organizations and users.
3. **Security Posture**: Exposing infrastructure topology or tenant aliases aids reconnaissance for targeted attacks.

## Decision
We enforce a strict zero-tolerance architectural policy against hardcoding client identifiers anywhere in the codebase:

1. **Strictly Prohibited in Source Code**:
   - No customer or client names, aliases, or domain identifiers (e.g., specific company names, internal session aliases) may ever be hardcoded as fallbacks, defaults, or literals in source code.
   - No AWS account numbers, tenant IDs, cluster ARNs, or private endpoint URLs belonging to real customer infrastructure may be committed to code or mock data.

2. **Dynamic Runtime Resolution**:
   - All tenant details, SSO session names, account IDs, and organization aliases must be discovered dynamically at runtime from local user configuration files (such as `~/.aws/config`, `~/.kube/config`, or environment variables).
   - If a fallback display value is required in the UI or CLI hint, generic placeholders MUST be used (e.g., `<session-name>`, `my-sso-session`, `<cluster-name>`, or generic demonstration defaults like `orgdemo`).

3. **Sanitization in Automated Assistant & Pair-Programming Guidelines**:
   - AI assistants and automated tooling must never copy active environment identifiers into proposed code changes.
   - All tests and fixtures must use synthetic, RFC-compliant dummy data (e.g., `111122223333`, `demo-org`, `https://your-org.awsapps.com/start`).

## Consequences

### Positive
- **Guaranteed Confidentiality**: Prevents any inadvertent leakage of proprietary customer names, account numbers, or infrastructure metadata.
- **Portability**: Ensures `k8sUI` remains completely agnostic and cleanly operable across any AWS IAM Identity Center organization or Kubernetes environment.
- **Compliance & Security**: Aligns with SOC 2, ISO 27001, and enterprise data protection standards.

### Negative / Trade-offs
- UI hints must rely on runtime state or generic placeholders (e.g., `{org.alias || '<session-name>'}`) rather than statically guessing session names.
