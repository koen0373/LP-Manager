#!/bin/bash
# SparkDEX NFPM Backfill via ANKR
# Indexes all SparkDEX V3 position transfers and events

set -e

echo "🚀 [SparkDEX Backfill] Starting..."
echo ""

# Check ANKR key
if [ -z "$ANKR_API_KEY" ]; then
  echo "❌ Error: ANKR_API_KEY not set"
  echo "   Export it first: export ANKR_API_KEY='your-key'"
  exit 1
fi

# SparkDEX NFPM
export SPARKDEX_NFPM="0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da"
export FLARE_RPC_URL="https://rpc.ankr.com/flare/${ANKR_API_KEY}"

# Indexer settings (ANKR can handle larger windows)
export INDEXER_RPS=10
export INDEXER_CONCURRENCY=5
export INDEXER_BLOCK_WINDOW=1000

echo "📋 Configuration:"
echo "   NFPM: $SPARKDEX_NFPM"
echo "   RPC: ANKR (Flare)"
echo "   Window: $INDEXER_BLOCK_WINDOW blocks"
echo "   Concurrency: $INDEXER_CONCURRENCY"
echo ""

# Check database
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL not set"
  exit 1
fi

echo "💾 Database: Railway Postgres (switchyard)"
echo ""

# Run indexer for SparkDEX NFPM
echo "🔍 [Phase 1] Indexing SparkDEX Position Transfers..."
echo "   (This may take 30-60 minutes for full history)"
echo ""

# Use npm script with custom NFPM
npm run indexer:backfill -- \
  --stream=nfpm \
  --rps=$INDEXER_RPS \
  --concurrency=$INDEXER_CONCURRENCY \
  --blockWindow=$INDEXER_BLOCK_WINDOW

echo ""
echo "✅ [SparkDEX Backfill] Complete!"
echo ""
echo "📊 Check results:"
echo "   psql \"\$DATABASE_URL\" -c \"SELECT nfpmAddress, COUNT(DISTINCT tokenId) FROM \\\"PositionTransfer\\\" GROUP BY nfpmAddress;\""
echo ""

