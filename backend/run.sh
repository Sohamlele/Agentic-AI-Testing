#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created backend/.env — add your API keys, then re-run."
fi

exec .venv/bin/uvicorn main:app --reload --host 127.0.0.1 --port 8000
