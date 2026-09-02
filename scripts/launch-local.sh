#!/usr/bin/env bash
# ==============================================================================
# k9sUI Local Launcher & Environment Diagnostics Script
# Checks host prerequisites, verifies stable toolchain versions, and launches k9sUI.
# ==============================================================================

set -euo pipefail

# Text formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
NC="\033[0m" # No Color

echo -e "${BOLD}${CYAN}======================================================${NC}"
echo -e "${BOLD}${CYAN}       k9sUI — Local Environment & Launch Manager     ${NC}"
echo -e "${BOLD}${CYAN}======================================================${NC}"
echo ""

# ------------------------------------------------------------------------------
# 1. OS & Architecture Detection
# ------------------------------------------------------------------------------
OS="$(uname -s)"
ARCH="$(uname -m)"
echo -e "${BOLD}1. Host Environment:${NC}"
echo -e "   • OS:           ${GREEN}${OS}${NC}"
echo -e "   • Architecture: ${GREEN}${ARCH}${NC}"

# ------------------------------------------------------------------------------
# 2. Node.js & Package Manager Diagnostics
# ------------------------------------------------------------------------------
echo ""
echo -e "${BOLD}2. JavaScript / Node.js Toolchain Check:${NC}"

if command -v node >/dev/null 2>&1; then
  NODE_VER="$(node -v)"
  NODE_MAJOR="$(node -v | cut -d'.' -f1 | tr -d 'v')"
  if [ "$NODE_MAJOR" -ge 20 ]; then
    echo -e "   • Node.js:      ${GREEN}${NODE_VER}${NC} (Meets >= v20 requirement)"
  else
    echo -e "   • Node.js:      ${YELLOW}${NODE_VER}${NC} (Warning: Node.js 20+ is recommended)"
  fi
else
  echo -e "   • Node.js:      ${RED}NOT FOUND${NC} (Please install Node.js v20+)"
  exit 1
fi

if [ -f "pnpm-lock.yaml" ] && command -v pnpm >/dev/null 2>&1; then
  PKG_MGR="pnpm"
  echo -e "   • Package Mgr:  ${GREEN}pnpm ($(pnpm -v))${NC}"
elif command -v npm >/dev/null 2>&1; then
  PKG_MGR="npm"
  echo -e "   • Package Mgr:  ${GREEN}npm ($(npm -v))${NC}"
elif command -v pnpm >/dev/null 2>&1; then
  PKG_MGR="pnpm"
  echo -e "   • Package Mgr:  ${GREEN}pnpm ($(pnpm -v))${NC}"
else
  echo -e "   • Package Mgr:  ${RED}NOT FOUND${NC}"
  exit 1
fi

# ------------------------------------------------------------------------------
# 3. Rust & Native Desktop Toolchain Check
# ------------------------------------------------------------------------------
echo ""
echo -e "${BOLD}3. Rust & Native Desktop Toolchain Check:${NC}"

HAS_RUST=false
if command -v rustc >/dev/null 2>&1 && command -v cargo >/dev/null 2>&1; then
  RUST_VER="$(rustc --version)"
  CARGO_VER="$(cargo --version)"
  echo -e "   • Rustc:        ${GREEN}${RUST_VER}${NC}"
  echo -e "   • Cargo:        ${GREEN}${CARGO_VER}${NC}"
  HAS_RUST=true
else
  if [ -f "$HOME/.cargo/bin/rustc" ]; then
    export PATH="$HOME/.cargo/bin:$PATH"
    RUST_VER="$(rustc --version)"
    echo -e "   • Rustc:        ${GREEN}${RUST_VER}${NC} (Found in ~/.cargo/bin)"
    HAS_RUST=true
  else
    echo -e "   • Rustc:        ${YELLOW}NOT FOUND in PATH${NC}"
    echo -e "     ${YELLOW}Tip: To run native Tauri desktop builds, install Rust from https://rustup.rs${NC}"
  fi
fi

# ------------------------------------------------------------------------------
# 4. OS-Specific Prerequisites
# ------------------------------------------------------------------------------
echo ""
echo -e "${BOLD}4. Platform Native Dependencies:${NC}"

case "$OS" in
  Darwin)
    if xcode-select -p >/dev/null 2>&1; then
      echo -e "   • Xcode CLI:    ${GREEN}Installed${NC} ($(xcode-select -p))"
    else
      echo -e "   • Xcode CLI:    ${YELLOW}Missing${NC} (Run: xcode-select --install)"
    fi
    echo -e "   • WebKit:       ${GREEN}Native macOS WebKit framework available${NC}"
    ;;
  Linux)
    if dpkg -s libwebkit2gtk-4.1-dev >/dev/null 2>&1 || rpm -q webkit2gtk4.1-devel >/dev/null 2>&1; then
      echo -e "   • WebKitGTK:    ${GREEN}Installed${NC}"
    else
      echo -e "   • WebKitGTK:    ${YELLOW}May need: sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev${NC}"
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*)
    echo -e "   • WebView2:     ${GREEN}Windows native WebView2 runtime${NC}"
    ;;
esac

# Check-only flag
if [[ "${1:-}" == "--check-only" || "${1:-}" == "-c" ]]; then
  echo ""
  echo -e "${GREEN}✅ Pre-flight environment check complete.${NC}"
  exit 0
fi

# ------------------------------------------------------------------------------
# 5. Dependency Installation & Launch Mode Selection
# ------------------------------------------------------------------------------
echo ""
echo -e "${BOLD}5. Project Dependencies & Launch Mode:${NC}"

if [ ! -d "node_modules" ]; then
  echo -e "   • node_modules missing. Running ${PKG_MGR} install..."
  $PKG_MGR install
else
  echo -e "   • Frontend node_modules: ${GREEN}Ready${NC}"
fi

echo ""
echo -e "${BOLD}${CYAN}------------------------------------------------------${NC}"
echo -e "${BOLD}Choose Launch Mode:${NC}"
echo -e "  [1] ${BOLD}Browser Dev Mode (Recommended for fast UI dev)${NC}"
echo -e "      Runs React + Vite with interactive mock Kubernetes cluster API."
echo -e "  [2] ${BOLD}Native Tauri Desktop Mode${NC}"
echo -e "      Compiles and runs the full Tauri Rust core + native window."
echo -e "${BOLD}${CYAN}------------------------------------------------------${NC}"

# Allow non-interactive mode via argument or prompt
MODE="${1:-}"

if [ -z "$MODE" ]; then
  read -r -p "Enter choice [1 or 2] (default: 1): " USER_CHOICE
  MODE="${USER_CHOICE:-1}"
fi

case "$MODE" in
  1|browser|web)
    echo ""
    echo -e "${GREEN}==> Launching k9sUI in Browser Dev Mode...${NC}"
    echo -e "Access the app at: ${BOLD}${CYAN}http://localhost:5173${NC}"
    $PKG_MGR run dev
    ;;
  2|desktop|tauri)
    if [ "$HAS_RUST" = false ]; then
      echo ""
      echo -e "${RED}Error: Rust toolchain is required for Native Desktop Mode.${NC}"
      echo -e "Install Rust via: ${BOLD}curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh${NC}"
      echo -e "Falling back to Browser Dev Mode..."
      $PKG_MGR run dev
    else
      echo ""
      echo -e "${GREEN}==> Launching k9sUI in Native Tauri Desktop Mode...${NC}"
      $PKG_MGR run tauri dev
    fi
    ;;
  *)
    echo -e "${RED}Invalid selection. Launching Browser Dev Mode by default.${NC}"
    $PKG_MGR run dev
    ;;
esac
