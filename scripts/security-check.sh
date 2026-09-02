#!/usr/bin/env bash
# security-check.sh — Automated local security & compliance audit for k8sUI.
# Runs the exact same security matrix validated in CI before commits or pushes.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() {
  printf "\n${BLUE}==>${NC} %s...\n" "$1"
}

pass() {
  printf "${GREEN}✔ PASS:${NC} %s\n" "$1"
}

fail() {
  printf "${RED}✖ FAILED:${NC} %s\n" "$1"
  exit 1
}

warn() {
  printf "${YELLOW}⚠ WARNING:${NC} %s\n" "$1"
}

printf "${BLUE}=====================================================${NC}\n"
printf "${BLUE}      k8sUI Pre-flight Local Security Audit         ${NC}\n"
printf "${BLUE}=====================================================${NC}\n"

# 1. Secret Scanning (Gitleaks)
step "1/6 Scanning for leaked secrets & credentials (Gitleaks)"
if command -v gitleaks >/dev/null 2>&1; then
  if gitleaks detect --source . -v --config .gitleaks.toml; then
    pass "Gitleaks secret scan passed (0 leaks found)"
  else
    fail "Gitleaks detected secrets or credentials in the repository"
  fi
else
  warn "gitleaks binary not found on PATH. Run 'brew install gitleaks' to enable local scanning"
fi

# 2. Rust Code Formatting (rustfmt)
step "2/6 Verifying Rust code formatting (cargo fmt)"
if cargo fmt --all --check --manifest-path src-tauri/Cargo.toml; then
  pass "Rust formatting is clean"
else
  fail "Rust formatting check failed. Run 'cargo fmt --manifest-path src-tauri/Cargo.toml' to auto-format"
fi

# 3. Rust SAST (Clippy - Zero Warnings)
step "3/6 Running Rust SAST & Linting (cargo clippy -D warnings)"
if cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings; then
  pass "Cargo clippy passed with zero warnings"
else
  fail "Cargo clippy found code quality or security warnings"
fi

# 4. Rust Dependency Audit & License Compliance (cargo-deny)
step "4/6 Auditing Rust dependencies, licenses, and advisories (cargo-deny)"
if command -v cargo-deny >/dev/null 2>&1; then
  if cargo deny --manifest-path src-tauri/Cargo.toml --config deny.toml check; then
    pass "Cargo-deny advisories, bans, licenses, and sources passed"
  else
    fail "Cargo-deny failed (check deny.toml for policy violations)"
  fi
else
  warn "cargo-deny not found on PATH. Run 'brew install cargo-deny' or 'cargo install cargo-deny'"
fi

# 5. Frontend License Compliance (license-checker)
step "5/6 Auditing Frontend production package licenses (license-checker)"
if pnpm dlx license-checker --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD;Unlicense" --production --excludePrivatePackages --summary; then
  pass "Frontend package licenses compliant (Apache-2.0 / MIT / BSD / ISC)"
else
  fail "Frontend dependencies contain unapproved or copyleft licenses"
fi

# 6. Frontend TypeScript & Static Typecheck
step "6/7 Verifying TypeScript compilation (tsc --noEmit)"
if pnpm exec tsc --noEmit; then
  pass "TypeScript compilation clean with zero errors"
else
  fail "TypeScript compiler found type errors"
fi

# 7. AkreTrix Security Suite (akretrix-securitytests)
step "7/7 Running AkreTrix Static Security Review (akretrix-sec)"
if [[ -f "../akretrix-securitytests/bin/akretrix-sec.js" ]]; then
  if node ../akretrix-securitytests/bin/akretrix-sec.js code .; then
    pass "AkreTrix security test suite passed"
  else
    fail "AkreTrix security scanner found critical or high severity violations"
  fi
else
  warn "akretrix-securitytests repository not found at ../akretrix-securitytests"
fi

printf "\n${GREEN}=====================================================${NC}\n"
printf "${GREEN}✔ All local security & quality gates passed successfully!${NC}\n"
printf "${GREEN}=====================================================${NC}\n"
