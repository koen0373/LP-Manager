# Plan: Missende Data Ophalen voor User Engagement Reports

**Datum:** 2025-11-10  
**Status:** ✅ **HAALBAAR** met enkele implementaties

---

## 📊 HUIDIGE SITUATIE

### **Kritieke Problemen:**
1. ❌ **220,634 PositionEvent rows hebben `pool='unknown'`** (100%!)
2. ❌ **Geen fees in USD** (moet berekend worden)
3. ❌ **Geen unclaimed fees tracking**
4. ❌ **PoolIncentive table is leeg** (0 rows)
5. ❌ **analytics_position_snapshot is leeg** (0 rows)

---

## ✅ WAT WE KUNNEN OPHALEN

### **1. Pool Attribution (P0 - Critical)**

**Probleem:** Alle PositionEvent rows hebben `pool='unknown'`

**Oplossing:**
- ✅ **NFPM.positions() RPC calls** - We hebben al code hiervoor (`pages/api/positions.ts`)
- ✅ **Factory.getPool()** - We hebben al code hiervoor
- ✅ **Backfill script bestaat** (`scripts/dev/fix-pool-by-nfpm-viem.mts`)

**Implementatie:**
```typescript
// Voor elke tokenId met pool='unknown':
1. Call NFPM.positions(tokenId) → krijg token0, token1, fee
2. Call Factory.getPool(token0, token1, fee) → krijg pool address
3. Update PositionEvent SET pool = poolAddress WHERE tokenId = X
```

**Geschatte tijd:** 
- 220K positions × 2 RPC calls = 440K calls
- Met rate limiting (10 calls/sec) = ~12 uur
- **Maar:** We kunnen batch processing doen voor actieve posities eerst

**Prioriteit:** 🔥 **P0 - Doen voor MVP**

---

### **2. Fees in USD (P0 - Critical)**

**Probleem:** PositionEvent heeft `amount0`/`amount1` maar geen `usdValue`

**Oplossing:**
- ✅ **CoinGecko API** - We hebben al `tokenPriceService.ts`
- ✅ **Pool metadata** - We hebben `token0Symbol`/`token1Symbol` in Pool table
- ✅ **Berekening:** `(amount0 × price0) + (amount1 × price1)`

**Implementatie:**
```typescript
// Voor elke COLLECT event zonder usdValue:
1. Get Pool → token0Symbol, token1Symbol, token0Decimals, token1Decimals
2. Get prices via getTokenPriceWithFallback()
3. Calculate: (amount0 / 10^decimals0) × price0 + (amount1 / 10^decimals1) × price1
4. Update PositionEvent SET usdValue = calculatedValue
```

**Geschatte tijd:**
- ~2,080 COLLECT events (laatste 7 dagen)
- Met caching: ~5 minuten

**Prioriteit:** 🔥 **P0 - Doen voor MVP**

---

### **3. Unclaimed Fees (P1 - High)**

**Probleem:** Geen tracking van unclaimed fees

**Oplossing:**
- ✅ **NFPM.positions()** geeft `tokensOwed0` en `tokensOwed1`
- ✅ **Vergelijk met laatste COLLECT event**
- ✅ **Bereken USD waarde** via token prices

**Implementatie:**
```typescript
// Voor elke actieve positie:
1. Call NFPM.positions(tokenId) → krijg tokensOwed0, tokensOwed1
2. Get Pool → token0Symbol, token1Symbol
3. Get prices → calculate USD value
4. Compare met laatste COLLECT event → verschil = unclaimed
```

**Geschatte tijd:**
- ~50K actieve posities × 1 RPC call = 50K calls
- Met rate limiting (10 calls/sec) = ~1.5 uur
- **Maar:** We kunnen dit per-user doen wanneer rapport gegenereerd wordt

**Prioriteit:** ⚠️ **P1 - Nice to have**

---

### **4. Rewards Data (P1 - High)**

**Probleem:** PoolIncentive table is leeg (0 rows)

**Oplossing:**
- ✅ **PoolIncentive model bestaat** in schema
- ✅ **Import script bestaat** (`scripts/data/import-incentives.ts`)
- ⚠️ **Data moet geïmporteerd worden** of via RPC opgehaald worden

**Implementatie opties:**
1. **Manual import** - JSON files met incentives data
2. **RPC calls** - Scan staking contracts voor rewards
3. **API calls** - Als er een rewards API bestaat

**Geschatte tijd:**
- Afhankelijk van data bron
- Manual import: ~1 uur
- RPC scanning: ~4-8 uur

**Prioriteit:** ⚠️ **P1 - Nice to have**

---

### **5. Position Snapshots (P2 - Medium)**

**Probleem:** analytics_position_snapshot is leeg

**Oplossing:**
- ✅ **PositionEvent history** bevat alle data
- ✅ **Bereken snapshots** uit PositionEvent aggregatie
- ✅ **Range status** kan berekend worden uit tick data

**Implementatie:**
```sql
-- Generate snapshots from PositionEvent history
INSERT INTO analytics_position_snapshot (positionIdFk, ts, amount0, amount1, tvlUsd, feesUsd, inRange)
SELECT 
  position_id,
  DATE_TRUNC('hour', to_timestamp(timestamp)) as ts,
  SUM(amount0) as amount0,
  SUM(amount1) as amount1,
  -- Calculate TVL and fees from events
  -- Calculate inRange from tick vs tickLower/tickUpper
FROM PositionEvent
GROUP BY position_id, ts;
```

**Geschatte tijd:**
- ~220K PositionEvent rows
- SQL query: ~5-10 minuten
- **Maar:** We kunnen dit real-time berekenen uit PositionEvent history

**Prioriteit:** 📊 **P2 - Kan real-time berekend worden**

---

### **6. Range Status History (P2 - Medium)**

**Probleem:** Geen historische range status data

**Oplossing:**
- ✅ **Tick data beschikbaar** in PositionEvent
- ✅ **Bereken in-range** uit `tick >= tickLower AND tick <= tickUpper`
- ✅ **Aggregeer over tijd** voor % tijd in-range

**Implementatie:**
```sql
-- Calculate % time in range from PositionEvent history
WITH position_ticks AS (
  SELECT 
    tokenId,
    tick,
    tickLower,
    tickUpper,
    timestamp,
    CASE 
      WHEN tick >= tickLower AND tick <= tickUpper THEN 1
      ELSE 0
    END as in_range
  FROM PositionEvent
  WHERE tick IS NOT NULL AND tickLower IS NOT NULL AND tickUpper IS NOT NULL
)
SELECT 
  tokenId,
  AVG(in_range) * 100 as pct_time_in_range
FROM position_ticks
GROUP BY tokenId;
```

**Geschatte tijd:**
- SQL query: ~1-2 minuten
- **Kan real-time berekend worden**

**Prioriteit:** 📊 **P2 - Kan real-time berekend worden**

---

## 🎯 IMPLEMENTATIE PLAN

### **Fase 1: Critical Fixes (Week 1)**

1. ✅ **Pool Attribution Backfill**
   - Run `scripts/dev/fix-pool-by-nfpm-viem.mts` voor actieve posities
   - Of maak nieuwe batch script voor alle `pool='unknown'`
   - **Doel:** <10% positions met `pool='unknown'`

2. ✅ **Fees USD Calculation**
   - Script om COLLECT events te updaten met `usdValue`
   - Gebruik `tokenPriceService.ts` voor prices
   - **Doel:** Alle COLLECT events hebben USD waarde

### **Fase 2: Enhanced Data (Week 2)**

3. ⚠️ **Unclaimed Fees Tracking**
   - Per-user RPC calls wanneer rapport gegenereerd wordt
   - Cache resultaten voor 1 uur
   - **Doel:** Unclaimed fees tonen in rapport

4. ⚠️ **Rewards Data Import**
   - Import incentives data in PoolIncentive table
   - Of implementeer RPC scanning
   - **Doel:** Rewards tonen in rapport

### **Fase 3: Analytics (Week 3)**

5. 📊 **Position Snapshots**
   - Generate uit PositionEvent history
   - Of real-time berekenen wanneer nodig
   - **Doel:** Range status history

---

## 📋 QUICK WINS (Kunnen we NU doen)

### **1. Fees USD Calculation Script**
```bash
# Run script om COLLECT events te updaten
npx tsx scripts/calculate-fees-usd.ts
```

### **2. Pool Attribution voor Top Users**
```bash
# Fix pool attribution voor top 1000 wallets eerst
npx tsx scripts/dev/fix-pool-by-nfpm-viem.mts --limit=1000
```

### **3. Range Status Query Fix**
```sql
-- Fix SQL syntax voor range status
-- (moet LATERAL join syntax aanpassen)
```

---

## ✅ CONCLUSIE

**JA, we kunnen de missende data ophalen!**

**Wat we NU kunnen doen:**
- ✅ Pool attribution (backfill script bestaat al)
- ✅ Fees USD calculation (CoinGecko API werkt)
- ✅ Range status (berekenen uit PositionEvent)

**Wat tijd kost:**
- ⚠️ Pool attribution: ~12 uur voor alle 220K positions (of batch voor actieve eerst)
- ⚠️ Unclaimed fees: Per-user RPC calls (kan gecached worden)

**Aanbeveling:**
1. **Start met pool attribution** voor actieve posities (top 10K wallets)
2. **Bereken fees USD** voor alle COLLECT events
3. **Implementeer unclaimed fees** per-user wanneer rapport gegenereerd wordt

**Volgende stap:** Wil je dat ik:
1. Het pool attribution backfill script run voor actieve posities?
2. Een fees USD calculation script maak?
3. Beide scripts combineer in één "data enrichment" pipeline?

