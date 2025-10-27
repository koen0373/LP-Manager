#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:3000}"
POOL_ID="${POOL_ID:-22003}"

echo "== / (homepage) =="
curl -sf "$BASE/" | head -n 5 || { echo "Homepage NOK"; exit 1; }

echo; echo "== /api/health =="
curl -sf "$BASE/api/health" || { echo "Health NOK"; exit 1; }

echo; echo "== pool cold =="
time curl -s "$BASE/api/pool/$POOL_ID" | head -n 30

echo; echo "== pool warm =="
time curl -s "$BASE/api/pool/$POOL_ID" | head -n 10
