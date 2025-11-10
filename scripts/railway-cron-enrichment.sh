#!/bin/bash
# Railway Cron Job Entrypoint for Hourly Enrichment
# 
# This script runs the enrichment cron job every hour
# Set RAILWAY_CRON_SCHEDULE="0 * * * *" in Railway environment variables

set -e

echo "[CRON] Starting hourly enrichment cron job..."
echo "[CRON] Schedule: ${RAILWAY_CRON_SCHEDULE:-0 * * * *}"
echo "[CRON] Started at: $(date)"

# Get Railway public URL
RAILWAY_PUBLIC_URL="${RAILWAY_PUBLIC_DOMAIN:-${RAILWAY_STATIC_URL}}"
if [ -z "$RAILWAY_PUBLIC_URL" ]; then
  echo "[CRON] ⚠️  Warning: RAILWAY_PUBLIC_DOMAIN not set, using localhost"
  RAILWAY_PUBLIC_URL="http://localhost:3000"
fi

# Get CRON_SECRET
CRON_SECRET="${CRON_SECRET}"
if [ -z "$CRON_SECRET" ]; then
  echo "[CRON] ❌ Error: CRON_SECRET environment variable not set"
  exit 1
fi

# Call the enrichment endpoint
ENDPOINT="${RAILWAY_PUBLIC_URL}/api/cron/enrichment-hourly"

echo "[CRON] Calling: $ENDPOINT"

curl -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  --max-time 1200 \
  --fail-with-body \
  -v

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "[CRON] ✅ Enrichment cron job completed successfully"
else
  echo "[CRON] ❌ Enrichment cron job failed with exit code $EXIT_CODE"
fi

exit $EXIT_CODE

