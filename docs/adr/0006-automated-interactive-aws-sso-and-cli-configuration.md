# ADR 0006: Automated & Interactive AWS CLI and IAM Identity Center (SSO) Configuration

## Status
Accepted

## Context
When developers or DevOps engineers launch `k8sUI` on a clean or newly configured workstation to administer Amazon EKS clusters, two primary friction points typically degrade the onboarding experience:

1. **Missing or Non-Standard AWS CLI Binary Path**:
   On macOS, applications launched from the desktop GUI (Dock, Spotlight, or Finder) do not inherit shell profile configurations (`.zshrc`, `.bashrc`). Consequently, binaries located in Homebrew directories (`/opt/homebrew/bin/aws` on Apple Silicon or `/usr/local/bin/aws` on Intel) may not be accessible in the default application `PATH`. If the AWS CLI is completely absent, operations querying EKS silently fail or return cryptic subprocess launch errors without user guidance.

2. **Unconfigured Local AWS Profiles**:
   When an organization registers an AWS IAM Identity Center (SSO) Start URL within the cluster discovery interface, `~/.aws/config` on the local machine often lacks the prerequisite `[sso-session <name>]` and account-level `[profile <profile-name>]` definitions. Subsequent cluster health checks or `aws eks update-kubeconfig` executions fail with:
   `"The config profile (<profile>) could not be found"`.

Rather than requiring operators to manually research configuration schemas, compose INI blocks, or run iterative terminal commands, the application must automatically configure missing prerequisites or interactively prompt with a single-click action to perform the setup ("do it or ask to configure if not exists").

Furthermore, all automation must strictly adhere to the organization's **Zero-Hardcoding and Client Privacy Policy**: no customer names, internal account IDs, IP addresses, tenant IDs, or infrastructure ARNs may ever be embedded in source code, default templates, or fallback values.

## Decision
We implement a resilient, dual-layer (backend Rust core and frontend React interface) automated configuration and diagnostic workflow:

### 1. Resilient AWS CLI Binary Resolution & Diagnostics
- **Path Resolution**: The backend (`src-tauri/src/connector/aws_sso.rs`) probes `/opt/homebrew/bin/aws`, `/usr/local/bin/aws`, and system `PATH`, dynamically extending execution environments when spawning `tokio::process::Command`.
- **System Health Probing**: An IPC command `check_aws_cli_installed` is exposed to allow the frontend to detect missing CLI tools on modal launch.
- **Actionable User Guidance**: When missing, the UI presents an alert banner with a copy-to-clipboard button for the installation command (`brew install awscli`) rather than failing silently.

### 2. Native OIDC Device Flow & Zero Static Credentials
- **Zero Static IAM Keys**: AWS SSO authentication leverages OIDC PKCE device authorization (`login_aws_sso_native`), producing short-lived STS tokens. No long-term IAM access keys or secrets are ever requested, processed, or persisted.
- **Browser-Driven Approval**: The backend registers client credentials against AWS OIDC endpoints, initiates device authorization, and opens the default browser directly to the verification URI.

### 3. Automated Profile Harvesting & `~/.aws/config` Generation
- **Safe Section Injection**: 
  - `ensure_sso_session_in_aws_config`: Checks `~/.aws/config` and appends `[sso-session <session-name>]` with `sso_start_url`, `sso_region`, and `sso_registration_scopes = sso:account:access` only if absent.
  - `append_sso_profile_to_aws_config`: Appends `[profile <profile-name>]` with session references, target account ID, role name, and region.
- **Dynamic Portal API Discovery**:
  - Upon obtaining a valid SSO access token (via active login or cached unexpired token in `~/.aws/sso/cache/`), the backend queries the AWS SSO Portal API (`https://portal.sso.{region}.amazonaws.com/assignment/accounts` and `/roles`).
  - All assigned accounts and roles accessible to the authenticated user are dynamically harvested and written into `~/.aws/config`, removing any need for manual profile authoring.

### 4. Interactive 1-Click UI Workflow
- **Registration Form Checkbox**:
  The organization registration modal includes an active toggle (*"Automatically authenticate in browser & configure profiles in ~/.aws/config"*), enabled by default. Submitting the form immediately initiates authorization, configures profiles, and triggers cluster scanning.
- **Zero-Cluster Discovery Card**:
  When an organization card has 0 discovered clusters due to missing profiles or expired sessions, the card displays an interactive **"Auto-Configure Profiles via SSO"** button that executes the full authorization and profile generation flow in one click.
- **Contextual Health Banner**:
  When cluster health monitoring detects `"AWS Profile Missing"` or `"AWS CLI ('aws') is not installed"`, the application banner presents contextual, one-click action buttons (`"Configure AWS SSO"` or `"Copy brew install"`) rather than generic failure messages.

### 5. Strict Zero-Hardcoding & Client Privacy Compliance
- All SSO session names, account IDs, account names, and aliases are derived dynamically at runtime from user input or local configuration.
- Generic placeholders (e.g., `<session-name>`, `<account-id>`, `<role-name>`) are strictly enforced in all UI hints, CLI instructions, and mock test fixtures.
- No client-specific infrastructure identifiers, tenant strings, or network addresses are stored or transmitted.

## Consequences

### Positive
- **Streamlined Workstation Setup**: Engineers can configure a new machine and discover all multi-account EKS clusters in under a minute without manually opening or editing `~/.aws/config`.
- **Elimination of Profile Missing Errors**: Automatically associates EKS clusters with verified, newly written AWS profiles matching user permissions.
- **Proactive Error Prevention**: Clear diagnostic banners guide users when OS-level dependencies (like the AWS CLI) are missing before discovery fails.
- **Privacy & Multi-Tenant Integrity**: Operates uniformly across any AWS IAM Identity Center instance without leaking sensitive customer metadata.

### Negative / Trade-offs
- Interactive SSO authentication requires a brief browser window launch for operator confirmation and MFA input.
