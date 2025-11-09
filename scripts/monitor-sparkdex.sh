#!/bin/bash
# Monitor SparkDEX backfill progress

export DATABASE_URL="postgresql://postgres:RPdRysYASfrgsufxDuXcdVYGfEBtGAyC@switchyard.proxy.rlwy.net:52817/railway"

echo "📊 SparkDEX Backfill Monitor"
echo "=============================="
echo ""

while true; do
  clear
  echo "📊 SparkDEX Backfill Progress - $(date '+%H:%M:%S')"
  echo "=================================================="
  echo ""
  
  # Check process
  if ps aux | grep "sparkdex-nfpm-direct.js" | grep -v grep > /dev/null; then
    echo "✅ Process: RUNNING"
  else
    echo "❌ Process: STOPPED"
  fi
  echo ""
  
  # Check database
  psql "$DATABASE_URL" -c "
    SELECT 
      CASE 
        WHEN \"nfpmAddress\" = '0xd9770b1c7a6ccd33c75b5bcb1c0078f46be46657' THEN 'Enosys'
        WHEN \"nfpmAddress\" = '0xee5ff5bc5f852764b5584d92a4d592a53dc527da' THEN 'SparkDEX'
        ELSE 'Unknown'
      END as dex,
      COUNT(DISTINCT \"tokenId\") as positions,
      COUNT(*) as total_events,
      MAX(\"blockNumber\") as latest_block
    FROM \"PositionTransfer\"
    WHERE \"nfpmAddress\" IS NOT NULL
    GROUP BY \"nfpmAddress\"
    ORDER BY \"nfpmAddress\";
  " 2>/dev/null
  
  echo ""
  echo "Press Ctrl+C to exit"
  echo ""
  
  sleep 10
done

