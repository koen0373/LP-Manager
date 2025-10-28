#!/bin/sh
# Lightweight smoke test for pricing endpoints
# Usage: BASE_URL=https://app.liquilab.io ./scripts/smoke_pricing.sh

set -e

BASE_URL=${BASE_URL:-http://127.0.0.1:3000}

printf '→ Checking /api/health at %s\n' "$BASE_URL"
HEALTH_RESPONSE=$(curl -sf "$BASE_URL/api/health")
printf '  ✓ health response received (%s bytes)\n' "${#HEALTH_RESPONSE}"

printf '→ Checking /api/admin/settings\n'
SETTINGS_RESPONSE=$(curl -sf "$BASE_URL/api/admin/settings")
printf '  ✓ settings response received (%s bytes)\n' "${#SETTINGS_RESPONSE}"

printf '→ Checking /api/billing/preview (activePools=7)\n'
PREVIEW_RESPONSE=$(curl -sf "$BASE_URL/api/billing/preview?activePools=7&billingCycle=month")
printf '  ✓ preview response received (%s bytes)\n' "${#PREVIEW_RESPONSE}"

export HEALTH_RESPONSE
export SETTINGS_RESPONSE
export PREVIEW_RESPONSE

python3 - <<'PY'
import json, os

health = json.loads(os.environ['HEALTH_RESPONSE'])
if not isinstance(health, dict):
    raise SystemExit('health payload unexpected')

settings = json.loads(os.environ['SETTINGS_RESPONSE'])
if 'settings' not in settings:
    raise SystemExit('settings payload missing `settings` key')

preview = json.loads(os.environ['PREVIEW_RESPONSE'])
pricing = preview.get('pricing') or {}
paid = int(pricing.get('paidPools', 0))
bonus = int(pricing.get('freeBonus', 0))
if paid != 10:
    raise SystemExit(f'Expected 10 paid pools for 7 active pools, got {paid}')
if bonus < 1:
    raise SystemExit('Expected at least 1 bonus pool in preview response')
print('✔ Smoke tests passed')
PY
