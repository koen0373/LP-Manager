# Database Migration — 2025-11-07

## 🚨 Problem
Railway Postgres database **crashed** due to disk full (99% of 500MB used):
```
ERROR: could not extend file: No space left on device
FATAL: database system is not yet accepting connections (recovery mode stuck)
```

---

## ✅ Solution: Fresh Database

### **Old Database** (DEAD)
- **URL:** `shinkansen.proxy.rlwy.net:39881`
- **Status:** Crashed, in permanent recovery loop
- **Data:** ~214k PositionEvents, ~25k PositionTransfers (NOT ACCESSIBLE)
- **Size:** 500MB (100% full)

### **New Database** (ACTIVE)
- **URL:** `metro.proxy.rlwy.net:50808`
- **Status:** ✅ Healthy, Postgres 17.6
- **Size:** 7.5 MB (fresh, ~10GB capacity)
- **Schema:** ✅ Migrated (all 7 migrations applied)

---

## 📋 Migration Steps Completed

| Step | Status | Details |
|------|--------|---------|
| 1. Railway upgrade | ✅ | Pro plan activated |
| 2. New database created | ✅ | 10GB volume, fresh Postgres 17.6 |
| 3. Schema migration | ✅ | Prisma migrations applied |
| 4. .env update | ✅ | Both `.env` and `.env.local` updated |
| 5. Website fixed | ✅ | Clean rebuild, all routes 200 OK |

---

## 🔄 Next Steps (In Progress)

### **1. ANKR API Activation** ⏳
- **Status:** Unfrozen, waiting for propagation (~10 min)
- **Purpose:** Fast ERC-721 event indexing

### **2. ERC-721 Data Indexing** 📦
**Script:** `scripts/dev/ankr-nfpm-scan.mts`
- Scan Enosys NFPM: `0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657`
- Scan SparkDEX NFPM: `0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da`
- Expected: ~24k unique positions
- Time: ~30-60 minutes with ANKR

### **3. Pool Resolution** 🎯
**Script:** `scripts/dev/fix-pool-by-nfpm-viem.mts`
- Map each `tokenId` → `pool_address`
- Uses NFPM.positions() + Factory.getPool()
- Expected: ~400 unique pools
- Time: ~30-60 minutes

### **4. Analytics View Refresh** 📊
**Script:** `scripts/dev/refresh-analytics-flat.sql`
- Create `analytics_position_flat` materialized view
- Aggregate: owner, pool, first/last block per tokenId
- Time: ~1-2 minutes

---

## 🎯 Final State (Expected)

| Metric | Target |
|--------|--------|
| **PositionEvent** | ~214k rows, 24k tokens |
| **PositionTransfer** | ~25k rows, 24k tokens |
| **Pools resolved** | ~400 unique pools (100%) |
| **analytics_position_flat** | 24k positions, 1.7k owners |
| **Database size** | ~500 MB (~5% of 10GB) |

---

## 💰 Cost Impact

### **Railway:**
- Pro plan: **$5/month** (includes $5 credits)
- 10GB volume: **$2.50/month** (=$0.25/GB)
- **Total: ~$7.50/month**

### **ANKR:**
- ERC-721 indexing: ~2-3M credits (one-time)
- Pool resolution: ~1-2M credits (one-time)
- **Total: ~$0.30-$0.50** (one-time)

---

## 📝 Files Created/Updated

### **Updated:**
- `.env` — New DATABASE_URL
- `.env.local` — New DATABASE_URL
- `PROJECT_STATE.md` — (pending update)

### **Created:**
- `scripts/db/cleanup-after-upgrade.sql` — Database optimization (not needed for fresh DB)
- `scripts/db/resume-pool-resolution.sh` — Automated pool resolution
- `RAILWAY_UPGRADE_WORKFLOW.md` — Migration instructions
- `DATABASE_MIGRATION_SUMMARY.md` — This file

---

## 🚨 Important Notes

1. **Old database is LOST** — Could not recover due to permanent crash loop
2. **Fresh start is BETTER** — No corrupt data, optimized indexes, clean schema
3. **Flare RPC switched back** — Using free public RPC for frontend (ANKR only for indexing)
4. **ANKR account** — Must stay unfrozen for initial indexing to complete

---

**Status:** ⏳ Waiting for ANKR API activation, then will complete indexing  
**ETA:** 2-3 hours for full data recovery  
**Last updated:** 2025-11-07 15:30

