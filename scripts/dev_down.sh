#!/usr/bin/env bash
set -euo pipefail
PORT="${PORT:-3000}"
if lsof -t -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  kill -15 $(lsof -t -iTCP:$PORT -sTCP:LISTEN) || true; sleep 1
  kill -9  $(lsof -t -iTCP:$PORT -sTCP:LISTEN) || true
  echo "🛑 Next dev gestopt op :$PORT"
else
  echo "ℹ️  Geen Next dev gevonden op :$PORT"
fi
