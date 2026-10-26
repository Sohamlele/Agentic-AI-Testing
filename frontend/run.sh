#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Avoid EMFILE "too many open files" watcher failures on macOS
ulimit -n 10240 2>/dev/null || true

if [[ ! -d node_modules ]]; then
  npm install
fi

exec npm run dev
