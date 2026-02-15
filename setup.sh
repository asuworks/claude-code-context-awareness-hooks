#!/usr/bin/env bash
# setup.sh — Unix wrapper for the cross-platform Node.js installer
# Usage: bash setup.sh [--uninstall | --test]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check Node.js is available
if ! command -v node &>/dev/null; then
  echo "[FAIL] Node.js is required but not found."
  echo "       Claude Code requires Node.js, so it should be installed."
  echo "       Install: https://nodejs.org/ or via your package manager."
  exit 1
fi

exec node "${SCRIPT_DIR}/setup.js" "$@"
