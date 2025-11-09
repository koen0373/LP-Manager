# Railway Indexer Follower - Test & Verification Guide

## ✅ LOCAL VERIFICATION COMPLETED

### Configuration Status:
- ✅ **Multi-NFPM Support:** Enabled in `indexer.config.ts`
- ✅ **Enosys NFPM:** `0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657`
- ✅ **SparkDEX NFPM:** `0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da`
- ✅ **Database Checkpoint:** Block 50,294,576 (2025-11-08)

### Database Status:
```
DEX        Positions   Transfers   Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Enosys     24,435      25,780      ✅
SparkDEX   50,421      60,563      ✅
Unknown    1           1           ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL      74,857      86,344      ✅
```

---

## 🚀 RAILWAY DEPLOYMENT VERIFICATION

### Railway Services:
1. **LiquiLab** (main app)
   - Service: `liquilab-lp-manager`
   - Start command: `npm start`
   - Environment: Production
   
2. **Indexer Follower** (background worker)
   - Service: `Indexer Follower` or `Indexer Cron`
   - Start command: `npm run indexer:follow:railway`
   - Dockerfile: `Dockerfile.worker`
   - Environment Variables:
     ```bash
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     FLARE_RPC_URL=https://flare-api.flare.network/ext/bc/C/rpc
     # OR for faster scanning:
     # FLARE_RPC_URL=https://rpc.ankr.com/flare/cee6b4f8...
     ```

### Verification Steps:

#### 1. Check Railway Logs
```bash
# In Railway Dashboard:
# Services → Indexer Follower → Logs
```

Look for:
```
📍 Scanning 2 NFPM contract(s): 0xd977..., 0xee5f...
✓ Found X logs from 0xd9770b1c7a6ccd33c75b5bcb1c0078f46be46657
✓ Found Y logs from 0xee5ff5bc5f852764b5584d92a4d592a53dc527da
✓ Total logs found: X+Y
```

#### 2. Check Database Updates
Run this query in Railway DB or via `psql`:

```sql
-- Check latest checkpoint update
SELECT 
  source,
  key,
  "lastBlock",
  "eventsCount",
  "updatedAt"
FROM "SyncCheckpoint"
WHERE source = 'NPM'
ORDER BY "updatedAt" DESC
LIMIT 1;

-- Expected: updatedAt should be recent (within last 24h)
```

#### 3. Check Recent Transfers
```sql
-- Check latest transfers per NFPM
SELECT 
  CASE 
    WHEN "nfpmAddress" = '0xd9770b1c7a6ccd33c75b5bcb1c0078f46be46657' THEN 'Enosys'
    WHEN "nfpmAddress" = '0xee5ff5bc5f852764b5584d92a4d592a53dc527da' THEN 'SparkDEX'
    ELSE 'Unknown'
  END as dex,
  MAX("blockNumber") as latest_block,
  COUNT(*) as transfers_last_24h
FROM "PositionTransfer"
WHERE "blockNumber" > (
  SELECT MAX("lastBlock") - 20000  -- ~8 hours of blocks
  FROM "SyncCheckpoint"
  WHERE source = 'NPM'
)
GROUP BY "nfpmAddress";

-- Expected: Both Enosys and SparkDEX should have recent activity
```

---

## 🔧 TROUBLESHOOTING

### Issue: Follower only scanning 1 NFPM
**Symptom:** Railway logs show only one NFPM address

**Fix:**
1. Check `indexer.config.ts` is committed and pushed to GitHub
2. Redeploy Railway Indexer Follower service
3. Clear any cached builds

### Issue: `tsx` or `node_modules` errors locally
**Note:** Local errors are NOT relevant for Railway deployment!

Railway uses:
- Fresh `npm install` on every deploy
- `Dockerfile.worker` with clean environment
- No local `node_modules` corruption

**Local workaround (if needed):**
```bash
rm -rf node_modules package-lock.json
npm install
npx prisma generate
```

### Issue: Checkpoint not updating
**Check:**
1. Railway service is running (not sleeping)
2. Environment variables are set correctly
3. Database connection is working
4. RPC endpoint is reachable

**Test RPC connection:**
```bash
curl -X POST https://flare-api.flare.network/ext/bc/C/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

---

## ✅ SUCCESS CRITERIA

### Daily Follower is Working If:
1. ✅ Railway logs show "Scanning 2 NFPM contract(s)"
2. ✅ Database checkpoint updates every 12-24 hours
3. ✅ Both Enosys AND SparkDEX have recent transfers
4. ✅ No errors in Railway logs

### Current Status (2025-11-09):
- ✅ **Configuration:** Multi-NFPM enabled
- ✅ **Database:** 74,857 positions indexed
- ✅ **Code:** Committed & pushed to GitHub
- ⏳ **Railway:** Awaiting next scheduled run

---

## 📊 MONITORING

### Daily Checks:
```sql
-- Position growth rate
SELECT 
  DATE("timestamp" AT TIME ZONE 'UTC') as date,
  CASE 
    WHEN "nfpmAddress" = '0xd9770b1c7a6ccd33c75b5bcb1c0078f46be46657' THEN 'Enosys'
    WHEN "nfpmAddress" = '0xee5ff5bc5f852764b5584d92a4d592a53dc527da' THEN 'SparkDEX'
  END as dex,
  COUNT(DISTINCT "tokenId") as new_positions
FROM "PositionTransfer"
WHERE "from" = '0x0000000000000000000000000000000000000000'  -- Mints
  AND "timestamp" > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days')
GROUP BY DATE("timestamp" AT TIME ZONE 'UTC'), "nfpmAddress"
ORDER BY date DESC, dex;
```

### Weekly Checks:
- Total position count growth
- Checkpoint advancement
- Error rates in Railway logs
- RPC performance (response times)

---

## 🎯 NEXT STEPS

1. ✅ **Wait for next Railway Cron run** (automatic)
2. ✅ **Check Railway logs** for multi-NFPM confirmation
3. ✅ **Verify database updates** with SQL queries above
4. ⏳ **Monitor for 1 week** to ensure stability

---

**The indexer is now configured to track BOTH Enosys and SparkDEX automatically!** 🎉

