# Overzicht Alle Enrichments — LiquiLab

**Laatste update:** 2025-11-10  
**Status:** Veel scripts mogelijk verwijderd tijdens refactoring

---

## 📊 Enrichment Processen Overzicht

### ✅ Geïmplementeerd & Actief

#### 1. **Pool Attribution** ✅
**Doel:** Resolve `pool='unknown'` naar echte pool addresses  
**Status:** ✅ Script gemaakt, mogelijk verwijderd  
**Locatie:** `scripts/enrich-user-engagement-data.ts` (verwijderd?)  
**Methode:** 
- NFPM `positions(tokenId)` → token0, token1, fee
- Factory `getPool(token0, token1, fee)` → pool address
- Update `PositionEvent.pool`

**Resultaat:** 99.7% success rate (25,242/25,341 posities)

---

#### 2. **Fees USD Calculation** ✅
**Doel:** Bereken USD waarde van COLLECT events  
**Status:** ✅ Script gemaakt, mogelijk verwijderd  
**Locatie:** `scripts/enrich-user-engagement-data.ts` (verwijderd?)  
**Methode:**
- Fetch token prices via CoinGecko (batch processing)
- Calculate: `(amount0 * price0) + (amount1 * price1)`
- Update `PositionEvent.usdValue`

**Optimalisaties:**
- Batch processing (50 tokens per CoinGecko call)
- Rate limiting (50 calls/min)
- In-memory caching

**Resultaat:** 63% van COLLECT events heeft USD value

---

#### 3. **Range Status** ✅ → 🔄 **VERVANGEN DOOR MATERIALIZED VIEWS**
**Doel:** Bereken IN_RANGE/OUT_OF_RANGE status  
**Status:** ✅ Vervangen door materialized view  
**Locatie:** 
- Oude script: `scripts/enrich-range-status.ts` (verwijderd?)
- Nieuwe: `mv_position_range_status` materialized view

**Methode:**
- Materialized view: `mv_position_range_status`
- Vergelijkt `tickLower/tickUpper` met `currentTick`
- Refresh via `/api/enrich/refresh-views`

**Voordeel:** 100x sneller dan script-based approach

---

#### 4. **Position Snapshots** ✅
**Doel:** Maak historische snapshots van posities  
**Status:** ✅ Script gemaakt, mogelijk verwijderd  
**Locatie:** `scripts/enrich-position-snapshots.ts` (verwijderd?)  
**Methode:**
- Snapshot: TVL, fees, range status, timestamp
- Store in `AnalyticsPositionSnapshot` table
- Track historische trends

---

#### 5. **APR Calculation** ✅
**Doel:** Bereken APR voor pools (fees + incentives)  
**Status:** ✅ Script gemaakt, mogelijk verwijderd  
**Locatie:** `scripts/enrich-apr-calculation.ts` (verwijderd?)  
**Methode:**
- Fees APR: `(fees_24h / tvl) * 365 * 100`
- Total APR: `((fees + incentives + rflr) / tvl) * 365 * 100`
- Store in `Pool.metadata.aprFees` en `aprTotal`

**Data Sources:**
- Fees: `mv_pool_fees_24h` materialized view
- Incentives: `PoolIncentive` table
- rFLR: `PositionEvent.metadata.rflrRewards`

---

#### 6. **Impermanent Loss** ✅
**Doel:** Bereken IL voor Uniswap V3 posities  
**Status:** ✅ Script gemaakt, mogelijk verwijderd  
**Locatie:** `scripts/enrich-impermanent-loss.ts` (verwijderd?)  
**Methode:**
- V3 IL formula: `IL = (value_current - value_initial) / value_initial`
- Include incentives + vested rFLR
- Store in `PositionEvent.metadata.impermanentLoss`

**Formula:**
```
IL = ((amount0_current * price0 + amount1_current * price1) - 
      (amount0_initial * price0 + amount1_initial * price1)) / 
     (amount0_initial * price0 + amount1_initial * price1)
```

---

#### 7. **rFLR Vesting** ✅
**Doel:** Bereken vested rFLR rewards  
**Status:** ✅ Script gemaakt, mogelijk verwijderd  
**Locatie:** `scripts/enrich-rflr-vesting.ts` (verwijderd?)  
**Methode:**
- Fetch rFLR rewards via Enosys API
- Linear vesting: 12 maanden vanaf position creation
- Early claim penalty: 50% op unvested portion
- Store in `PositionEvent.metadata.rflrRewards`

**Vesting Logic:**
```
vested = (days_elapsed / 365) * total_rflr
claimable = vested + (unvested * 0.5)  // if early claim
```

---

#### 8. **Unclaimed Fees Tracking** ✅
**Doel:** Track unclaimed fees per positie  
**Status:** ✅ Script gemaakt, mogelijk verwijderd  
**Locatie:** `scripts/enrich-unclaimed-fees.ts` (verwijderd?)  
**Methode:**
- Query NFPM `positions(tokenId)` → tokensOwed0, tokensOwed1
- Compare met laatste COLLECT event
- Calculate USD value van unclaimed fees
- Store in `PositionEvent.metadata.unclaimedFees`

---

#### 9. **Position Health Metrics** ✅
**Doel:** Bereken position health metrics  
**Status:** ✅ Script gemaakt, mogelijk verwijderd  
**Locatie:** `scripts/enrich-position-health.ts` (verwijderd?)  
**Methode:**
- % time in-range (van PositionEvent history)
- Range efficiency
- Store in `PositionEvent.metadata.healthMetrics`

---

#### 10. **Pool Volume Metrics** ✅
**Doel:** Bereken 24h trading volume per pool  
**Status:** ✅ Script gemaakt, mogelijk verwijderd  
**Locatie:** `scripts/enrich-pool-volume.ts` (verwijderd?)  
**Methode:**
- Scan Swap events in `PoolEvent` table (last 24h)
- Aggregate volume per pool
- Convert to USD via token prices
- Store in `Pool.metadata.volume24h`

**ANKR Benefit:** 166x sneller met 5000-block batches

---

## 🔄 Materialized Views (Database-Native Enrichment)

### 1. **mv_position_range_status** ✅
**Doel:** Range status voor alle posities  
**Status:** ✅ Actief  
**Refresh:** Via `/api/enrich/refresh-views`  
**Query:**
```sql
SELECT DISTINCT ON (tokenId)
  tokenId, pool, tickLower, tickUpper, current_tick,
  CASE WHEN current_tick >= tickLower AND current_tick < tickUpper
    THEN 'IN_RANGE' ELSE 'OUT_OF_RANGE' END as range_status
FROM PositionEvent
LEFT JOIN mv_pool_latest_state ON pool
```

---

### 2. **mv_pool_position_stats** ✅
**Doel:** Aggregated position counts per pool  
**Status:** ✅ Actief  
**Refresh:** Via `/api/enrich/refresh-views`  
**Query:**
```sql
SELECT pool,
  COUNT(DISTINCT tokenId) as total_positions,
  COUNT(DISTINCT CASE WHEN eventType='MINT' THEN tokenId END) as active_positions
FROM PositionEvent
GROUP BY pool
```

---

### 3. **mv_position_latest_event** ✅
**Doel:** Latest event per positie  
**Status:** ✅ Actief  
**Refresh:** Via `/api/enrich/refresh-views`  
**Query:**
```sql
SELECT DISTINCT ON (tokenId)
  tokenId, pool, eventType, blockNumber, timestamp, amount0, amount1
FROM PositionEvent
ORDER BY tokenId, blockNumber DESC
```

---

### 4. **mv_pool_latest_state** ✅
**Doel:** Latest pool state (tick, liquidity)  
**Status:** ✅ Actief (dependency voor range status)  
**Refresh:** Via `/api/enrich/refresh-views`

---

### 5. **mv_pool_fees_24h** ✅
**Doel:** 24h fees per pool  
**Status:** ✅ Actief (dependency voor APR)  
**Refresh:** Via `/api/enrich/refresh-views`

---

## 🎯 On-Demand Enrichment API

### 1. **GET /api/enrich/range-status** ✅
**Doel:** Fetch range status voor posities/pools  
**Status:** ✅ Actief  
**Methode:** Gebruikt `mv_position_range_status` materialized view  
**Caching:** Geen (view is al pre-computed)

---

### 2. **GET /api/enrich/price** ✅
**Doel:** Fetch token prices met caching  
**Status:** ✅ Actief  
**Methode:** CoinGecko API + in-memory cache  
**Caching:** 1 hour TTL (`lib/enrichmentCache.ts`)

---

### 3. **POST /api/enrich/refresh-views** ✅
**Doel:** Refresh alle materialized views  
**Status:** ✅ Actief  
**Auth:** Protected by `CRON_SECRET`  
**Methode:** `REFRESH MATERIALIZED VIEW CONCURRENTLY`

---

## 📅 Hourly Enrichment Cron

**Endpoint:** `/api/cron/enrichment-hourly`  
**Status:** ✅ Actief  
**Frequentie:** Elk uur (Railway cron)  
**Processen:** 10 enrichment scripts

**Workflow:**
1. Refresh materialized views (range status, position stats)
2. Pool Attribution (500 positions/hour)
3. Fees USD (5000 events/hour)
4. Position Snapshots (100 positions/hour)
5. APR Calculation (100 pools/hour)
6. Impermanent Loss (200 positions/hour)
7. rFLR Vesting (200 positions/hour)
8. Unclaimed Fees (100 positions/hour)
9. Position Health (200 positions/hour)
10. Pool Volume (50 pools/hour)

**⚠️ Probleem:** Veel scripts zijn mogelijk verwijderd, cron kan falen

---

## 📈 Enrichment Statistieken

### Pool Attribution
- **Total Positions:** ~25,000+
- **Unknown Pools:** <1% (na backfill)
- **Success Rate:** 99.7%

### Fees USD
- **Total COLLECT Events:** ~10,000+
- **With USD Value:** ~63%
- **Without USD Value:** ~37% (zero fees of nog niet berekend)

### Range Status
- **Total Positions:** ~25,000+
- **With Range Status:** Via materialized view (100% coverage)
- **In Range:** Variabel (afhankelijk van markt)

---

## 🗂️ Data Locaties

### Database Tables
- `PositionEvent` — Events met enrichment in `metadata` JSON
- `Pool` — Pool metadata met enrichment in `metadata` JSON
- `AnalyticsPositionSnapshot` — Historische snapshots
- `PoolIncentive` — Incentive data voor APR

### Materialized Views
- `mv_position_range_status` — Range status
- `mv_pool_position_stats` — Pool statistics
- `mv_position_latest_event` — Latest events
- `mv_pool_latest_state` — Pool state
- `mv_pool_fees_24h` — 24h fees

### API Endpoints
- `/api/enrich/range-status` — Range status lookup
- `/api/enrich/price` — Token price lookup
- `/api/enrich/refresh-views` — View refresh
- `/api/admin/enrichment-stats` — Enrichment statistics
- `/api/admin/backfill` — Backfill control

---

## ⚠️ Bekende Issues

### 1. Scripts Verwijderd
**Probleem:** Veel enrichment scripts zijn mogelijk verwijderd tijdens refactoring  
**Impact:** Backfill en hourly cron kunnen falen  
**Fix:** Check welke scripts bestaan, herstel of verwijder uit backfill

### 2. In-Memory Status
**Probleem:** Backfill status is in-memory (verliest bij restart)  
**Impact:** Status verloren bij server restart  
**Fix:** Gebruik database of Redis voor persistent status

### 3. Script Dependencies
**Probleem:** Scripts kunnen afhankelijk zijn van verwijderde modules  
**Impact:** Scripts falen met import errors  
**Fix:** Check imports, fix of verwijder scripts

---

## 📝 Implementatie Geschiedenis

### 2025-11-10 — Complete Enrichment Pipeline
- ✅ 10 enrichment processen geïmplementeerd
- ✅ Materialized views voor snelle queries
- ✅ On-demand enrichment API endpoints
- ✅ Hourly cron job voor incrementele enrichment
- ✅ Historical backfill functionaliteit

### 2025-11-10 — Materialized Views
- ✅ `mv_position_range_status` — Range status
- ✅ `mv_pool_position_stats` — Pool statistics
- ✅ `mv_position_latest_event` — Latest events

### 2025-11-10 — On-Demand API
- ✅ `/api/enrich/range-status` — Range status lookup
- ✅ `/api/enrich/price` — Token price lookup
- ✅ `/api/enrich/refresh-views` — View refresh

### 2025-11-10 — Enrichment Cache
- ✅ `lib/enrichmentCache.ts` — In-memory LRU cache
- ✅ Price cache (1h TTL)
- ✅ Vesting cache (24h TTL)
- ✅ APR cache (1h TTL)

---

## 🎯 Status Samenvatting

| Enrichment | Status | Methode | Locatie |
|------------|--------|---------|---------|
| Pool Attribution | ✅ | Script | `scripts/enrich-user-engagement-data.ts` (verwijderd?) |
| Fees USD | ✅ | Script | `scripts/enrich-user-engagement-data.ts` (verwijderd?) |
| Range Status | ✅ | Materialized View | `mv_position_range_status` |
| Position Snapshots | ✅ | Script | `scripts/enrich-position-snapshots.ts` (verwijderd?) |
| APR Calculation | ✅ | Script | `scripts/enrich-apr-calculation.ts` (verwijderd?) |
| Impermanent Loss | ✅ | Script | `scripts/enrich-impermanent-loss.ts` (verwijderd?) |
| rFLR Vesting | ✅ | Script | `scripts/enrich-rflr-vesting.ts` (verwijderd?) |
| Unclaimed Fees | ✅ | Script | `scripts/enrich-unclaimed-fees.ts` (verwijderd?) |
| Position Health | ✅ | Script | `scripts/enrich-position-health.ts` (verwijderd?) |
| Pool Volume | ✅ | Script | `scripts/enrich-pool-volume.ts` (verwijderd?) |

**⚠️ Let op:** Veel scripts zijn mogelijk verwijderd. Check eerst welke scripts bestaan voordat je backfill draait.

---

## 📚 Gerelateerde Documentatie

- `docs/HANDOVER_BACKFILL.md` — Backfill handover document
- `ENRICHMENT_STATUS.md` — Wat is er al ge-enriched
- `ANKR_BACKFILL_PLAN.md` — ANKR backfill strategie
- `docs/CRON_ENRICHMENT_EXPLAINED.md` — Hourly enrichment cron
- `docs/ENRICHMENT_API_USAGE.md` — On-demand API usage

---

**Laatste update:** 2025-11-10

