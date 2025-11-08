# Railway Database Upgrade — Post-Upgrade Workflow

## 🚨 Current Issue
Railway Postgres database is **full** (5GB limit reached):
```
ERROR: could not extend file: No space left on device
ERROR: could not write to file pgsql_tmp: No space left on device
```

**Status before upgrade:**
- ✅ **214,947** PositionEvent rows (24,268 unique tokens)
- ✅ **25,615** PositionTransfer rows
- ⏸️ **~9,100 tokens** resolved (pools known)
- ❌ **~14,600 tokens** still unknown (stopped due to disk full)

---

## 📋 Post-Upgrade Checklist

### **Step 1: Verify Railway Upgrade** ✅
In Railway dashboard:
1. Go to project → Database
2. Upgrade to **Developer** ($10/mo, 100GB) or **Team** ($25/mo, 500GB)
3. Wait for upgrade to complete (~5-10 minutes)
4. Verify new disk limit:
   ```bash
   psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
   ```

### **Step 2: Database Cleanup** 🗑️
Run the cleanup script to reclaim space and optimize:

```bash
cd /Users/koen/Desktop/Liquilab
export DATABASE_URL="postgresql://postgres:***@shinkansen.proxy.rlwy.net:39881/railway?sslmode=require"
psql $DATABASE_URL -f scripts/db/cleanup-after-upgrade.sql
```

**What it does:**
- ✅ VACUUM FULL (reclaim disk space)
- ✅ Remove old checkpoints (>30 days)
- ✅ Delete duplicate events
- ✅ REINDEX all tables
- ✅ Show before/after disk usage

**Expected time:** 5-15 minutes  
**Expected space freed:** 20-30% (1-2 GB)

### **Step 3: Resume Pool Resolution** ⚡
Continue resolving tokenId→pool mappings with ANKR RPC:

```bash
cd /Users/koen/Desktop/Liquilab
./scripts/db/resume-pool-resolution.sh
```

**What it does:**
- ✅ Checks remaining unknown tokens
- ✅ Runs batches of 10k tokens (concurrency=10)
- ✅ Automatically stops when all resolved
- ✅ Shows progress after each batch

**Expected time:** 30-60 minutes for ~14,600 remaining tokens  
**ANKR cost:** ~1-2M credits ($0.10-$0.20)

### **Step 4: Refresh Analytics View** 📊
Update the materialized view with resolved pools:

```bash
npm run sql:refresh:analytics-flat
```

**What it does:**
- ✅ Drops and recreates `analytics_position_flat`
- ✅ Aggregates latest owner + pool per tokenId
- ✅ Creates indexes for fast queries

**Expected time:** 1-2 minutes

### **Step 5: Verify Data** ✅
Check final stats:

```bash
export DATABASE_URL="postgresql://postgres:***@shinkansen.proxy.rlwy.net:39881/railway?sslmode=require"

# Pool resolution status
psql $DATABASE_URL -c "
SELECT 
  CASE WHEN pool = 'unknown' THEN 'unknown' ELSE 'known' END as status,
  COUNT(*) as events,
  COUNT(DISTINCT \"tokenId\") as unique_tokens
FROM \"PositionEvent\"
GROUP BY CASE WHEN pool = 'unknown' THEN 'unknown' ELSE 'known' END;
"

# Analytics view status
psql $DATABASE_URL -c "
SELECT 
  COUNT(*) as total_positions,
  COUNT(DISTINCT owner_address) as unique_owners,
  COUNT(DISTINCT pool_address) as unique_pools,
  COUNT(CASE WHEN pool_address = 'unknown' THEN 1 END) as unknown_pools
FROM analytics_position_flat;
"
```

**Expected results:**
- ✅ `PositionEvent`: 0 unknown tokens
- ✅ `analytics_position_flat`: ~24,000 positions, ~1,700 owners, ~400+ pools

---

## 🎯 Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| **Database size** | ~5 GB (100% full) | ~4 GB (40% used on 10GB) |
| **Tokens with pool** | 501 (2%) | 24,268 (100%) |
| **Unknown pools** | 23,767 | 0 |
| **Unique pools** | 1 | 400+ |
| **API errors** | 500 (disk full) | 200 OK |

---

## 🚨 If Issues Persist

### **Database still full after cleanup:**
```bash
# Check table sizes
psql $DATABASE_URL -c "
SELECT
  schemaname || '.' || tablename AS table_name,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
"

# Consider archiving old data (blocks < 48000000)
```

### **ANKR rate limits:**
Lower concurrency in `resume-pool-resolution.sh`:
```bash
--concurrency=5  # Instead of 10
```

### **Still getting errors:**
Contact me with:
1. Output of cleanup script
2. Current database size
3. Error messages

---

## 📚 Related Scripts

- `scripts/db/cleanup-after-upgrade.sql` — Database cleanup
- `scripts/db/resume-pool-resolution.sh` — Resume pool resolution
- `scripts/dev/fix-pool-by-nfpm-viem.mts` — NFPM resolver (called by resume script)
- `scripts/dev/refresh-analytics-flat.sql` — Refresh analytics view
- `scripts/dev/verify-tokenid-pool.sql` — Verify pool resolution

---

**Last updated:** 2025-11-07  
**Status:** Ready to run after Railway upgrade ✅

