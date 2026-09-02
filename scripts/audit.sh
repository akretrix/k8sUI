#!/usr/bin/env bash
# audit.sh — re-runnable health check for k8sUI.
#
# Encodes the findings from the parity review as executable assertions so the
# state of the tree can be checked at any time instead of re-reviewed by hand.
#
#   ./scripts/audit.sh           full run
#   ./scripts/audit.sh --fast    skip cargo (build + clippy), ~2s instead of ~60s
#
# Exit codes: 0 all gates pass · 1 one or more BLOCKER/FAIL gates failed.

set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
ROOT=$(pwd)
FAST=0
[[ "${1:-}" == "--fast" ]] && FAST=1

if [[ -t 1 ]]; then
  R=$'\033[31m'; G=$'\033[32m'; Y=$'\033[33m'; B=$'\033[1m'; D=$'\033[2m'; N=$'\033[0m'
else
  R=""; G=""; Y=""; B=""; D=""; N=""
fi

FAILED=0
WARNED=0

pass() { printf '  %sPASS%s  %-46s %s\n'  "$G" "$N" "$1" "${2:-}"; }
fail() { printf '  %sFAIL%s  %-46s %s\n'  "$R" "$N" "$1" "${2:-}"; FAILED=$((FAILED+1)); }
warn() { printf '  %sWARN%s  %-46s %s\n'  "$Y" "$N" "$1" "${2:-}"; WARNED=$((WARNED+1)); }
skip() { printf '  %sSKIP%s  %-46s %s\n'  "$D" "$N" "$1" "${2:-}"; }
head() { printf '\n%s%s%s\n' "$B" "$1" "$N"; }

# Count matches without tripping `set -e`-style short circuits.
count() { grep -rEc "$1" ${2:+$2} 2>/dev/null | awk -F: '{s+=$NF} END {print s+0}'; }
hits()  { grep -rE "$1" $2 2>/dev/null | wc -l | tr -d ' '; }

printf '%sk8sUI audit%s  %s  %s\n' "$B" "$N" \
  "$(git rev-parse --short HEAD 2>/dev/null || echo 'no-commit')" \
  "$(date '+%Y-%m-%d %H:%M')"

# ---------------------------------------------------------------- build gates
head "Build & test gates"

if [[ $FAST -eq 1 ]]; then
  skip "cargo check" "--fast"
  skip "cargo clippy (-D warnings)" "--fast"
else
  if cargo check --manifest-path src-tauri/Cargo.toml --quiet >/dev/null 2>&1; then
    pass "cargo check"
  else
    fail "cargo check" "crate does not compile"
  fi

  CLIPPY=$(cargo clippy --manifest-path src-tauri/Cargo.toml --message-format short 2>&1 \
           | grep -cE 'warning' || true)
  if [[ "$CLIPPY" -eq 0 ]]; then
    pass "cargo clippy (-D warnings)"
  else
    fail "cargo clippy (-D warnings)" "$CLIPPY warnings — CI gates on this"
  fi
fi

if npx --no-install tsc --noEmit >/dev/null 2>&1; then
  pass "tsc --noEmit"
else
  fail "tsc --noEmit" "type errors"
fi

if npx --no-install vitest run >/dev/null 2>&1; then
  VT=$(npx --no-install vitest run 2>&1 | grep -oE 'Tests +[0-9]+ passed' | grep -oE '[0-9]+' || echo '?')
  pass "vitest run" "$VT tests"
else
  fail "vitest run" "suite is red"
fi

RUST_TESTS=$(count '#\[(tokio::)?test\]' src-tauri/src)
if [[ "$RUST_TESTS" -ge 20 ]]; then
  pass "rust test count" "$RUST_TESTS"
else
  warn "rust test count" "$RUST_TESTS — security invariants are untested in Rust"
fi

# ------------------------------------------------------------------- blockers
head "Blockers"

# The mock layer must not be reachable when the Tauri IPC bridge is present.
# The dangerous shape is a catch inside invokeTauri that swallows an IPC error
# and falls through to mockClient — that renders fabricated cluster data.
INVOKE_FN=$(sed -n '/async function invokeTauri/,/^}/p' src/api/tauriClient.ts 2>/dev/null)
if grep -q 'catch' <<<"$INVOKE_FN"; then
  fail "IPC errors are not swallowed into mocks" "catch in invokeTauri falls through to mockClient"
elif grep -q 'throw' <<<"$INVOKE_FN"; then
  pass "IPC errors are not swallowed into mocks"
else
  warn "IPC errors are not swallowed into mocks" "could not parse invokeTauri — check by hand"
fi

# Browser preview legitimately uses mocks, but should say so on screen.
if grep -rqi 'demo data\|mock data\|preview mode' src/App.tsx src/components 2>/dev/null; then
  pass "mock mode is visible to the user"
else
  warn "mock mode is visible to the user" "npm run dev shows invented prod clusters with no banner"
fi

# Playwright specs must have somewhere to run.
if [[ -f playwright.config.ts || -f playwright.config.js ]]; then
  if grep -q '"test:e2e"' package.json; then
    pass "e2e is runnable" "config + script present"
  else
    warn "e2e is runnable" "config present, no test:e2e script"
  fi
else
  E2E_SPECS=$(ls tests/*.spec.ts 2>/dev/null | wc -l | tr -d ' ')
  fail "e2e is runnable" "$E2E_SPECS spec(s), no playwright.config — they run nowhere"
fi

# Subsystems that exist in Rust but may not be exposed over IPC.
# Match whole command identifiers — a substring search gives false positives
# ("ai" matches get_available_clusters).
HANDLER=$(sed -n '/invoke_handler/,/])/p' src-tauri/src/lib.rs 2>/dev/null)
check_ipc() { # <label> <regex over full command names>
  if grep -qE "commands::($2)\b" <<<"$HANDLER"; then
    pass "IPC exposes: $1"
  else
    fail "IPC exposes: $1" "module compiles but no command reaches it"
  fi
}
check_ipc "exec terminal" 'start_terminal.*|.*terminal_session|write_terminal.*|close_terminal.*'
check_ipc "port-forward"  'start_port_forward|stop_port_forward|list_port_forwards'
check_ipc "AI copilot"    '[a-z_]*ai[a-z_]*'

CMD_COUNT=$(sed -n '/invoke_handler/,/])/p' src-tauri/src/lib.rs | grep -c 'commands::' || echo 0)
printf '  %sinfo%s  %-46s %s\n' "$D" "$N" "registered commands" "$CMD_COUNT"

# ------------------------------------------------------- architecture / claims
head "Documented claims vs. code"

KUBECTL=$(hits 'Command::new\("kubectl"\)' src-tauri/src)
if [[ "$KUBECTL" -eq 0 ]]; then
  pass "ADR 0003: no kubectl subprocess"
else
  fail "ADR 0003: no kubectl subprocess" "$KUBECTL call site(s)"
fi

# Type names like DryRunResult are not evidence. Look for the request actually
# carrying the dry-run flag to the API server.
if grep -rqE '\.dry_run\(|dry_run: *true|PatchParams *\{[^}]*dry_run' src-tauri/src 2>/dev/null; then
  pass "server-side dry-run is real"
else
  fail "server-side dry-run is real" "diff is built client-side; dryRun=All never sent"
fi

if grep -q 'server_validation_passed: true' src-tauri/src/connector/local.rs 2>/dev/null; then
  fail "dry-run validation is not hardcoded" "server_validation_passed: true is a literal"
else
  pass "dry-run validation is not hardcoded"
fi

if grep -rq 'aws_sigv4\|sign(' src-tauri/src/connector/eks.rs 2>/dev/null; then
  pass "EKS token is SigV4-signed"
else
  fail "EKS token is SigV4-signed" "base64 of a static URL — API server will reject"
fi

if grep -rq 'rusqlite' src-tauri/src/core/audit.rs 2>/dev/null; then
  pass "audit log is persisted"
else
  fail "audit log is persisted" "in-memory RwLock<Vec>; lost on quit"
fi

WATCH=$(hits 'runtime::watcher|watcher::watcher|reflector' src-tauri/src)
if [[ "$WATCH" -gt 0 ]]; then
  pass "watch-based streaming"
else
  POLL=$(hits 'refetchInterval' src)
  fail "watch-based streaming" "no watcher; $POLL polling table(s) re-LIST on an interval"
fi

if grep -rq 'metrics.k8s.io\|PodMetrics\|NodeMetrics' src-tauri/src 2>/dev/null; then
  pass "live metrics from metrics-server"
else
  fail "live metrics from metrics-server" "pod cpu/mem are None; dashboard is static"
fi

# With a discovery-driven client every kind the cluster serves is reachable, so
# the meaningful question is whether that path exists — not how many match arms do.
if grep -rq 'discovery::Discovery\|Api::all_with\|Api::namespaced_with' src-tauri/src 2>/dev/null; then
  NAV=$(grep -cE "^\s+\{ id: '" src/components/layout/Sidebar.tsx 2>/dev/null || echo 0)
  pass "nav items backed by the client" "discovery-driven; $NAV nav items"
else
  fail "nav items backed by the client" "no dynamic client — kinds are hardcoded"
fi

# ------------------------------------------------------------------- hardening
head "Hardening & hygiene"

CSP=$(grep -o '"csp": *[^,}]*' src-tauri/tauri.conf.json 2>/dev/null | head -1)
if [[ "$CSP" == *"null"* || -z "$CSP" ]]; then
  fail "CSP is set" "csp is null — no policy"
else
  pass "CSP is set"
fi

if grep -q 'core:default' src-tauri/capabilities/*.json 2>/dev/null; then
  warn "capabilities are least-privilege" "core:default is broad; enumerate what is used"
else
  pass "capabilities are least-privilege"
fi

PANICS=$(hits 'panic!|\.expect\(|\.unwrap\(\)' src-tauri/src/commands)
if [[ "$PANICS" -eq 0 ]]; then
  pass "no panics in command handlers"
else
  fail "no panics in command handlers" "$PANICS — panic=abort kills the app"
fi

if grep -q 'forbid(unsafe_code)' src-tauri/src/lib.rs 2>/dev/null; then
  pass "#![forbid(unsafe_code)]"
else
  warn "#![forbid(unsafe_code)]" "one line, matches the stated posture"
fi

if git ls-files --error-unmatch src-tauri/Cargo.lock >/dev/null 2>&1; then
  pass "Cargo.lock committed"
else
  fail "Cargo.lock committed" "application crates must commit the lockfile"
fi

STORE=$(git ls-files 2>/dev/null | grep -c 'pnpm-store' || true)
LOCKS=0
[[ -f package-lock.json ]] && LOCKS=$((LOCKS+1))
[[ -f pnpm-lock.yaml   ]] && LOCKS=$((LOCKS+1))
if [[ "$STORE" -eq 0 && "$LOCKS" -le 1 ]]; then
  pass "single package manager"
else
  warn "single package manager" "$STORE pnpm-store file(s) tracked, $LOCKS lockfile(s)"
fi

if [[ -f SECURITY.md || -f .github/SECURITY.md ]]; then
  pass "SECURITY.md is discoverable"
else
  warn "SECURITY.md is discoverable" "lives in docs/security/; GitHub only reads root or .github/"
fi

# --------------------------------------------------------------------- summary
head "Summary"
if [[ $FAILED -eq 0 && $WARNED -eq 0 ]]; then
  printf '  %sAll gates pass.%s\n\n' "$G" "$N"
elif [[ $FAILED -eq 0 ]]; then
  printf '  %s%d warning(s)%s, no failures.\n\n' "$Y" "$WARNED" "$N"
else
  printf '  %s%d failure(s)%s, %s%d warning(s)%s.\n\n' "$R" "$FAILED" "$N" "$Y" "$WARNED" "$N"
fi

exit $(( FAILED > 0 ? 1 : 0 ))
