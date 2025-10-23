#!/bin/sh
# Railway backfill script for specific positions

echo "🔄 Starting Railway backfill..."

# Use direct database connection for backfill (bypass Prisma Accelerate)
if [ -n "$DIRECT_DATABASE_URL" ]; then
  echo "📡 Using direct database connection"
  export DATABASE_URL="$DIRECT_DATABASE_URL"
fi

# Run backfill for your main positions
npx tsx scripts/backfillLedger.ts 22003 22326 20445 21866 --verbose

echo "✅ Railway backfill complete!"

