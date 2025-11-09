# SparkDEX NFPM Backfill - Handover to ChatGPT

**Date:** 2025-11-09 13:30 CET  
**Context:** LiquiLab V3 LP Position Tracker - Railway Database Backfill

---

## 🎯 OBJECTIVE

We need to backfill **SparkDEX NFPM (ERC-721) position transfers** into the Railway PostgreSQL database. We already have:
- ✅ **Enosys NFPM positions:** 24,435 positions indexed
- ✅ **SparkDEX pool metadata:** 177 pools indexed
- ❌ **SparkDEX NFPM positions:** 0 positions (MISSING)

---

## 📊 CURRENT DATABASE STATUS

**Railway Database:** `switchyard.railway.internal:5432`  
**Connection String:** `postgresql://postgres:RPdRysYASfrgsufxDuXcdVYGfEBtGAyC@switchyard.proxy.rlwy.net:52817/railway`

### Data Inventory:
| Table | Enosys | SparkDEX | Status |
|-------|--------|----------|--------|
| **Pool** | 61 pools | 177 pools | ✅ Complete |
| **PositionTransfer** | 24,435 positions | **0 positions** | ❌ Missing |
| **PoolEvent** | ~607K events | ~607K events | ✅ Complete (mixed) |
| **PositionEvent** | ~216K events | Unknown | ✅ Partial |

### Contract Addresses:
```typescript
// Enosys V3 NFPM (working ✅)
ENOSYS_NFPM = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657'

// SparkDEX V3 NFPM (needs backfill ❌)
SPARKDEX_NFPM = '0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da'

// Block range
START_BLOCK = 29837200  // First V3 activity
LATEST_BLOCK = ~50303055
```

---

## 🔧 CHANGES MADE

### 1. Updated `indexer.config.ts`
Changed `contracts.npm` from single string to **array of NFPMs**:

```typescript
contracts: {
  npm: [
    process.env.ENOSYS_NFPM || '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657',
    process.env.SPARKDEX_NFPM || '0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da',
  ],
  // ...
}
```

### 2. Updated `src/indexer/indexerCore.ts`
Modified `index()` method to scan multiple NFPMs:

```typescript
// Normalize npm config to array
const npmAddresses = Array.isArray(indexerConfig.contracts.npm) 
  ? indexerConfig.contracts.npm 
  : [indexerConfig.contracts.npm];

console.log(`[INDEXER] 📍 Scanning ${npmAddresses.length} NFPM contract(s)`);

// Scan all NFPM contracts
let allLogs: any[] = [];
for (const npmAddress of npmAddresses) {
  const scanResult = await this.scanner.scan({
    fromBlock,
    toBlock,
    contractAddress: npmAddress,
    tokenIds,
    dryRun,
  });
  console.log(`[INDEXER] ✓ Found ${scanResult.logs.length} logs from ${npmAddress}`);
  allLogs = allLogs.concat(scanResult.logs);
}

// Decode all collected logs
const decodedEvents = this.decoder.decodeBatch(allLogs);
```

### 3. Schema Already Supports Distinction
The `PositionTransfer` table has `nfpmAddress` column to distinguish between Enosys and SparkDEX:

```prisma
model PositionTransfer {
  id           String  @id @default(uuid())
  tokenId      String
  from         String
  to           String
  blockNumber  Int
  txHash       String
  logIndex     Int
  nfpmAddress  String? // ← This distinguishes Enosys vs SparkDEX
  
  @@unique([txHash, logIndex])
  @@index([tokenId])
  @@index([blockNumber])
  @@index([nfpmAddress]) // ← Index for filtering
}
```

---

## ❌ PROBLEM ENCOUNTERED

### Issue: `tsx` Command Not Found / Corrupted
When trying to run the indexer locally:

```bash
$ npm run indexer:backfill:railway
> tsx scripts/indexer-backfill.ts --stream=nfpm --rps=10 --concurrency=5

sh: tsx: command not found
```

Or when using `npx tsx`:

```bash
$ npx tsx scripts/indexer-backfill.ts
TypeError: Cannot read properties of undefined (reading 'validator')
    at Object.<anonymous> (.prisma/client/index.js:61:27)
```

### Root Cause:
- **Corrupted `node_modules`** due to previous failed installations
- **Prisma Client** not properly regenerated
- **tsx** either missing or pointing to corrupted modules

---

## 🚫 SOLUTIONS ATTEMPTED

### 1. ❌ Direct `npx tsx` execution
```bash
npx tsx scripts/indexer-backfill.ts --stream=nfpm --rps=10 --concurrency=5 --blockWindow=1000
```
**Result:** Prisma Client validator error

### 2. ❌ Regenerate Prisma Client
```bash
npx prisma generate
```
**Result:** Module not found error for `@prisma/fetch-engine`

### 3. ❌ Clean Prisma reinstall
```bash
rm -rf node_modules/.pnpm/@prisma*
npm install
```
**Result:** Directory not empty errors, incomplete deletion

### 4. ❌ Full node_modules reinstall
```bash
rm -rf node_modules
npm install
```
**Result:** Takes too long, interrupted by corrupted directories

### 5. ❌ Created plain Node.js script (`sparkdex-nfpm-direct.js`)
Attempted to bypass tsx using plain JS with Viem:
```bash
node scripts/sparkdex-nfpm-direct.js
```
**Result:** Viem module resolution errors (`Cannot find module '../../utils/abi/encodeEventTopics.js'`)

### 6. ❌ Background npm script
```bash
npm run indexer:backfill:railway &
```
**Result:** Process exits immediately, tsx not found

---

## 🎯 GOAL FOR CHATGPT

**Please backfill SparkDEX NFPM positions into the Railway database.**

### Success Criteria:
1. ✅ Query shows SparkDEX positions in database:
   ```sql
   SELECT 
     CASE 
       WHEN "nfpmAddress" = '0xee5ff5bc5f852764b5584d92a4d592a53dc527da' THEN 'SparkDEX'
       ELSE 'Other'
     END as dex,
     COUNT(DISTINCT "tokenId") as positions
   FROM "PositionTransfer"
   WHERE LOWER("nfpmAddress") = '0xee5ff5bc5f852764b5584d92a4d592a53dc527da'
   GROUP BY "nfpmAddress";
   ```
   Expected: ~800-1500 SparkDEX positions

2. ✅ Checkpoint created:
   ```sql
   SELECT * FROM "SyncCheckpoint" 
   WHERE source = 'NPM' AND key = 'global' 
   ORDER BY "lastBlock" DESC LIMIT 1;
   ```

---

## 💡 SUGGESTED APPROACHES

### Option A: Fix Local Environment (Recommended)
1. **Clean node_modules properly:**
   ```bash
   # macOS/Linux - force delete with sudo if needed
   rm -rf node_modules package-lock.json
   npm cache clean --force
   npm install
   npx prisma generate
   ```

2. **Run indexer locally with ANKR:**
   ```bash
   export DATABASE_URL="postgresql://postgres:RPdRysYASfrgsufxDuXcdVYGfEBtGAyC@switchyard.proxy.rlwy.net:52817/railway"
   npm run indexer:backfill:railway
   ```

### Option B: Railway Cron with ANKR (Alternative)
1. **Update Railway Cron environment variables:**
   - Service: **Indexer Cron** (or create new service)
   - Set: `FLARE_RPC_URL` = `https://rpc.ankr.com/flare/cee6b4f8...` (ANKR URL)
   - Or: Add `INDEXER_USE_ANKR=true` flag

2. **Trigger manually or wait for scheduled run**

3. **After backfill completes, revert to Flare RPC** for daily updates

### Option C: One-time Railway Service
Create a dedicated Railway service just for this backfill:
- **Dockerfile:** `Dockerfile.worker`
- **Start Command:** `npm run indexer:backfill:railway`
- **Environment:** ANKR RPC URL
- **Auto-sleep:** After completion

---

## 📁 KEY FILES

- **Indexer Config:** `indexer.config.ts` (updated ✅)
- **Indexer Core:** `src/indexer/indexerCore.ts` (updated ✅)
- **Backfill Script:** `scripts/indexer-backfill.ts`
- **Database Schema:** `prisma/schema.prisma`
- **Package Scripts:** `package.json` → `indexer:backfill:railway`

---

## 🔐 CREDENTIALS

### Database (Railway)
```
Host: switchyard.proxy.rlwy.net
Port: 52817
User: postgres
Password: RPdRysYASfrgsufxDuXcdVYGfEBtGAyC
Database: railway
```

### RPC Endpoints
```bash
# ANKR RPC (fast, costs credits)
ANKR_HTTP_URL=https://rpc.ankr.com/flare/cee6b4f8...

# Flare Public RPC (free, slower, 30-block limit)
FLARE_RPC_URL=https://flare-api.flare.network/ext/bc/C/rpc
```

---

## ⚠️ IMPORTANT NOTES

1. **Enosys vs SparkDEX UI Difference:**
   - User noted that FlareScan displays Enosys and SparkDEX positions differently
   - Example wallets:
     - Enosys: `0xA7C9E7343bD8f1eb7000F25dE5aeb52c6B78B1b7`
     - SparkDEX: `0x88D46717b16619B37fa2DfD2F038DEFB4459F1F7`
   - **However:** Both use standard ERC-721 `Transfer` events
   - **For indexer:** No difference, same ABI, same logic

2. **Both NFPMs should be backfilled by ONE script:**
   - Once working, daily CRON should update BOTH Enosys and SparkDEX
   - Current config already supports this (array of NPM addresses)

3. **ANKR vs Flare RPC:**
   - ANKR: Fast, reliable, costs credits (~$10-20 for full backfill)
   - Flare RPC: Free, slower, 30-block window limit
   - **For backfill:** Use ANKR
   - **For daily updates:** Use Flare RPC (free)

---

## 🚀 EXPECTED OUTCOME

After successful backfill:

```sql
-- Should show BOTH Enosys and SparkDEX
SELECT 
  CASE 
    WHEN "nfpmAddress" = '0xd9770b1c7a6ccd33c75b5bcb1c0078f46be46657' THEN 'Enosys'
    WHEN "nfpmAddress" = '0xee5ff5bc5f852764b5584d92a4d592a53dc527da' THEN 'SparkDEX'
  END as dex,
  COUNT(DISTINCT "tokenId") as positions,
  MAX("blockNumber") as latest_block
FROM "PositionTransfer"
GROUP BY "nfpmAddress"
ORDER BY "nfpmAddress";

-- Expected output:
--   dex     | positions | latest_block
-- ----------+-----------+--------------
--  Enosys   |     24435 |     50291147
--  SparkDEX |     ~1200 |     50303055
```

---

## 📞 CONTACT

**User:** Koen  
**Project:** LiquiLab V3 LP Position Tracker  
**Status:** SparkDEX backfill blocked by local tsx/node_modules corruption  
**Urgency:** Medium - database is operational, just missing SparkDEX position data

---

**Good luck, ChatGPT! 🚀**

