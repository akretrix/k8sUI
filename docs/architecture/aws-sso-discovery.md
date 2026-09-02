# AWS IAM Identity Center (AWS SSO) Multi-Org Auto-Discovery

This document details the security architecture and implementation for registering multiple AWS IAM Identity Center organizations (e.g. `https://your-org.awsapps.com/start`) and automatically discovering Amazon EKS clusters across multiple AWS accounts.

---

## 1. Zero-Trust Security Invariants

1. **Zero Permanent Access Keys**:
   No `aws_access_key_id` or `aws_secret_access_key` pairs are stored on disk or in configuration files.
2. **Ephemeral In-Memory Role Credentials**:
   Authentication uses short-lived tokens (15–60 minutes) obtained via AWS SSO OIDC device code / PKCE flows.
3. **Environment Tier Segregation**:
   Clusters discovered from accounts with `prod` in their name/tags are automatically designated as `Production` (crimson badge, read-only mode locked by default).
4. **Non-Repudiation Audit**:
   Every cluster discovery query, role assumption, and manifest operation is logged locally in the audit store with the user's individual IAM Identity Center identity.

---

## 2. Multi-Org Discovery Architecture

```
User (k8sUI Desktop)
      │
      │ 1. Enter SSO Start URL (e.g. https://your-org.awsapps.com/start)
      ▼
┌────────────────────────────────────────────────────────┐
│  AwsSsoManager (Rust Core)                             │
│  - Registers OIDC Client (sso-oidc:RegisterClient)     │
│  - Starts Device Auth Flow (sso-oidc:StartDeviceAuth)  │
└──────────────────────────┬─────────────────────────────┘
                           │ 2. Opens Browser with FIDO2 MFA
                           ▼
┌────────────────────────────────────────────────────────┐
│  AWS IAM Identity Center (https://your-org.awsapps.com)│
│  - User authorizes via WebAuthn / Passkey / YubiKey    │
│  - Issues short-lived SSO Access Token                 │
└──────────────────────────┬─────────────────────────────┘
                           │ 3. SSO Token received in-memory
                           ▼
┌────────────────────────────────────────────────────────┐
│  Multi-Account & Multi-Region EKS Crawler              │
│  - sso:ListAccounts (retrieves all accessible accounts)│
│  - sso:ListAccountRoles (identifies assigned roles)    │
│  - sso:GetRoleCredentials (ephemeral STS session)      │
│  - eks:ListClusters + eks:DescribeCluster (per region) │
└──────────────────────────┬─────────────────────────────┘
                           │ 4. Populates Cluster Contexts
                           ▼
┌────────────────────────────────────────────────────────┐
│  Cluster Switcher Dropdown (k8sUI)                     │
│  ├── Org: Your Organization (us-east-1)              │
│  │   ├── your-org-payments-prod (Production)           │
│  │   └── your-org-api-staging   (Staging)              │
│  └── Local Clusters                                    │
│      └── kind-k9s-dev           (Local)                │
└────────────────────────────────────────────────────────┘
```

---

## 3. How to Register & Use Multiple AWS Orgs

1. Open **k8sUI**.
2. Click the **Cluster Switcher** in the top navigation bar.
3. Click **+ Add AWS IAM Identity Center (SSO) Org**.
4. Enter the **SSO Start URL** (e.g. `https://your-org.awsapps.com/start`), alias, and region.
5. Click **Connect & Auto-Discover EKS Clusters**.
6. The app opens your browser for one-time SSO approval. Once approved, all EKS clusters across all your accessible AWS accounts appear automatically in the Cluster Switcher.
