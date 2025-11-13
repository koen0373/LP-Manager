#!/bin/bash
# Quick start script for ANKR historical backfill

echo "🚀 Starting ANKR Historical Backfill..."
echo ""

# Set ANKR URL
export ANKR_HTTP_URL="https://rpc.ankr.com/flare/cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01"
export INDEXER_BLOCK_WINDOW=5000

echo "✅ Environment variables set:"
echo "   ANKR_HTTP_URL: ${ANKR_HTTP_URL:0:50}..."
echo "   INDEXER_BLOCK_WINDOW: $INDEXER_BLOCK_WINDOW"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not set. Loading from .env.local..."
  if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
    echo "✅ Loaded from .env.local"
  else
    echo "❌ .env.local not found. Please set DATABASE_URL manually."
    exit 1
  fi
fi

echo ""
echo "📊 Starting backfill..."
echo "   Estimated time: ~15-20 hours"
echo "   Estimated cost: ~\$0.14 USD (ANKR)"
echo ""
echo "💡 Tip: You can stop with Ctrl+C and resume later"
echo ""

# Run the backfill script
npm run enrichment:backfill-ankr
