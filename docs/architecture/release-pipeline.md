# Multiplatform Release Pipeline & Distribution Architecture

This document describes the automated multiplatform build, packaging, signing, and distribution pipeline for **k8sUI**.

---

## 1. Pipeline Architecture Overview

```
Maintainer Trigger (GitHub Action or `npm run release:*`)
      │
      ▼
┌────────────────────────────────────────────────────────┐
│  Stage 1: Version Bumping & DCO Signed Tagging         │
│  - package.json, Cargo.toml, and tauri.conf.json sync  │
│  - DCO 'Signed-off-by:' commit verification            │
│  - Push Git Tag: 'vX.Y.Z'                              │
└──────────────────────────┬─────────────────────────────┘
                           │ triggers .github/workflows/release.yml
                           ▼
┌────────────────────────────────────────────────────────┐
│  Stage 2: Pre-Release Verification Gate (Ubuntu)       │
│  - cargo-deny license & advisory verification          │
│  - npm audit (0 high/critical vulnerabilities)         │
│  - cargo clippy (-D warnings) & test suite             │
└──────────────────────────┬─────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Stage 3a:    │    │ Stage 3b:    │    │ Stage 3c:    │
│ macOS Build  │    │ Windows      │    │ Linux        │
│ (ARM64/x64)  │    │ (MSI + NSIS) │    │ (.deb/.AppImg│
│ DMG & .app   │    │              │    │              │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       └───────────────────┼───────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│  Stage 4: Supply Chain Security & Attestation          │
│  - Generate CycloneDX SBOM (Rust crates + Node modules)│
│  - Compute SHA256SUMS for all installer binaries       │
│  - Keyless Sigstore / Cosign signing via GitHub OIDC   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  Stage 5: GitHub Release Publish                       │
│  - Attach multiplatform installers                    │
│  - Attach SBOMs (.cdx.json) & Signatures (.bundle.json)│
│  - Auto-generate release notes from conventional commit│
└────────────────────────────────────────────────────────┘
```

---

## 2. Supported Distribution Artifacts

| Platform | Architecture | Installer Formats | Target File Patterns |
| :--- | :--- | :--- | :--- |
| **macOS** | Apple Silicon (`aarch64`) | `.dmg`, `.app` | `k8sUI_*_aarch64.dmg` |
| **macOS** | Intel x86_64 | `.dmg`, `.app` | `k8sUI_*_x64.dmg` |
| **Windows** | x86_64 | `.msi` (MSI installer), `.exe` (NSIS setup) | `k8sUI_*_x64-setup.exe`, `*.msi` |
| **Linux** | x86_64 | `.deb` (Debian/Ubuntu), `.AppImage` (Universal) | `k8sui_*_amd64.deb`, `*.AppImage` |

---

## 3. Supply Chain Integrity & Attestations

1. **CycloneDX SBOM**:
   Machine-readable Software Bill of Materials generated for every build:
   - `rust-bom.cdx.json` (all compiled crates and transitive dependencies).
   - `frontend-bom.cdx.json` (all client JS packages).
2. **Sigstore / Cosign Keyless Signing**:
   - `SHA256SUMS` checksum manifest signed using GitHub Actions OIDC identity.
   - SBOMs signed and bundled (`.bundle.json`) for cryptographic verification by downstream users.
3. **Verification Command for Users**:
   ```bash
   cosign verify-blob \
     --bundle SHA256SUMS.bundle.json \
     --certificate-identity-regexp "https://github.com/k9sui/k9sui/.github/workflows/release.yml" \
     --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
     SHA256SUMS
   ```

---

## 4. How to Trigger a Release

### Option A: From GitHub Actions (Recommended)
1. Navigate to the **Actions** tab in GitHub.
2. Select **Tag New Release**.
3. Choose the bump type (`patch`, `minor`, or `major`) and click **Run workflow**.
4. The workflow will automatically update versions, sign the commit with DCO, push the tag, and trigger the multiplatform build.

### Option B: From Local Terminal
```bash
# Bumps version, updates Cargo.toml/tauri.conf.json, signs commit with DCO, and creates git tag:
npm run release:patch    # e.g. 0.1.0 -> 0.1.1
# or
npm run release:minor    # e.g. 0.1.0 -> 0.2.0

# Push changes and tags to trigger GitHub Actions release:
git push origin main && git push origin --tags
```
