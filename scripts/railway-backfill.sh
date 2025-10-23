#!/bin/sh
# Railway backfill script for specific positions

echo "🔄 Starting Railway backfill..."

# Use direct Postgres connection for backfill (bypass Prisma Accelerate)
if [ -n "$POSTGRES_URL" ]; then
  echo "📡 Using direct Postgres connection (bypassing Accelerate)"
  export DATABASE_URL="$POSTGRES_URL"
elif [ -n "$DIRECT_DATABASE_URL" ]; then
  echo "📡 Using DIRECT_DATABASE_URL"
  export DATABASE_URL="$DIRECT_DATABASE_URL"
fi

# Run backfill for your main positions
npx tsx scripts/backfillLedger.ts 22003 22326 20445 21866 --verbose

echo "✅ Railway backfill complete!"

