#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

case "${1:-}" in
  backend)
    exec "$ROOT/backend/run.sh"
    ;;
  frontend)
    exec "$ROOT/frontend/run.sh"
    ;;
  seed)
    cd "$ROOT/backend"
    if [[ ! -d .venv ]]; then
      python3 -m venv .venv
      .venv/bin/pip install -r requirements.txt
    fi
    exec .venv/bin/python seed.py "${@:2}"
    ;;
  health)
    echo -n "frontend: "; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/ || echo down
    echo -n "backend:  "; curl -s http://127.0.0.1:8000/health || echo down
    echo
    ;;
  *)
    cat <<EOF
TestAgent helper

Usage:
  ./scripts/dev.sh backend     Start FastAPI (port 8000)
  ./scripts/dev.sh frontend    Start Next.js (port 3000)
  ./scripts/dev.sh seed        Seed sample PRs (offline generator)
  ./scripts/dev.sh seed --ai   Seed using Claude (needs ANTHROPIC_API_KEY)
  ./scripts/dev.sh health      Ping both services
EOF
    exit 1
    ;;
esac
