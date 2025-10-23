#!/bin/bash
# Railway entrypoint: run backfill once, then start indexer

set -e

echo "🚀 Railway startup..."

# Check if backfill should run
if [ "$RUN_BACKFILL" = "true" ]; then
  echo "🔄 Running backfill..."
  npm run backfill:railway || echo "⚠️ Backfill failed, continuing..."
fi

# Start the indexer
echo "📊 Starting indexer follower..."
exec npm run indexer:follow

