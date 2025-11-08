#!/bin/bash
set -euo pipefail

# =========================================================================
# Resume ANKR Pool Resolution — Post Railway Upgrade
# =========================================================================
# Purpose: Continue resolving tokenId→pool mappings after DB upgrade
# Usage: ./scripts/db/resume-pool-resolution.sh
# =========================================================================

cd "$(dirname "$0")/../.."

# Load env vars
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Required env vars
: "${DATABASE_URL:?DATABASE_URL not set}"
: "${ENOSYS_NFPM:=0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657}"
: "${SPARKDEX_NFPM:=0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da}"
: "${ENOSYS_V3_FACTORY:=0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de}"
: "${SPARKDEX_V3_FACTORY:=0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652}"
: "${ANKR_API_KEY:?ANKR_API_KEY not set}"

export ANKR_HTTP_URL="https://rpc.ankr.com/flare/${ANKR_API_KEY}"

echo "=========================================="
echo "LiquiLab Pool Resolution — Resume"
echo "=========================================="
echo ""

# Check remaining unknown tokens
UNKNOWN_COUNT=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(DISTINCT \"tokenId\") 
  FROM \"PositionEvent\" 
  WHERE pool = 'unknown';
" | tr -d ' ')

echo "📊 Remaining unknown tokens: $UNKNOWN_COUNT"
echo ""

if [ "$UNKNOWN_COUNT" -eq 0 ]; then
  echo "✅ All tokens already resolved!"
  exit 0
fi

# Calculate batches (10k per batch, concurrency=10 for ANKR)
TOTAL_BATCHES=$(( ($UNKNOWN_COUNT + 9999) / 10000 ))
echo "🔄 Running $TOTAL_BATCHES batches (10k tokens each, concurrency=10)"
echo ""

for ((i=0; i<$TOTAL_BATCHES; i++)); do
  OFFSET=$((i * 10000))
  BATCH=$((i + 1))
  
  echo "--- Batch $BATCH/$TOTAL_BATCHES (offset=$OFFSET) ---"
  
  pnpm exec tsx scripts/dev/fix-pool-by-nfpm-viem.mts \
    --limit=10000 \
    --offset=$OFFSET \
    --concurrency=10
  
  # Check if we should continue
  REMAINING=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(DISTINCT \"tokenId\") 
    FROM \"PositionEvent\" 
    WHERE pool = 'unknown';
  " | tr -d ' ')
  
  echo "✓ Batch $BATCH complete. Remaining: $REMAINING"
  echo ""
  
  if [ "$REMAINING" -eq 0 ]; then
    echo "🎉 All tokens resolved!"
    break
  fi
  
  # Small delay between batches to avoid rate limits
  sleep 2
done

echo ""
echo "=========================================="
echo "Pool Resolution Complete"
echo "=========================================="
echo ""

# Final stats
psql "$DATABASE_URL" -c "
SELECT 
  CASE WHEN pool = 'unknown' THEN 'unknown' ELSE 'known' END as status,
  COUNT(*) as events,
  COUNT(DISTINCT \"tokenId\") as unique_tokens
FROM \"PositionEvent\"
GROUP BY CASE WHEN pool = 'unknown' THEN 'unknown' ELSE 'known' END
ORDER BY status;
"

echo ""
echo "✅ Next step: Refresh analytics_position_flat"
echo "   Run: npm run sql:refresh:analytics-flat"

