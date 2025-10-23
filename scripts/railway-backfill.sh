#!/bin/bash
# Railway backfill script for specific positions

echo "🔄 Starting Railway backfill..."

# Run backfill for your main positions
npx tsx scripts/backfillLedger.ts 22003 22326 20445 21866 --verbose

echo "✅ Railway backfill complete!"

