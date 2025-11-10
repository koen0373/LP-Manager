# User Engagement Report - Data Availability Assessment

**Datum:** 2025-11-10  
**Test Wallet:** `0xf406b4e97c31420D91fBa42a3a9D8cfe47BF710b` (973 positions)

---

## ✅ BESCHIKBARE DATA

### **A. Performance & Profitabiliteit**

#### ✅ **Week Performance Overview**
- **Status:** ✅ **Beschikbaar**
- **Data:**
  - Active positions: ✅ (973 voor test wallet)
  - Active pools: ✅ (maar veel `pool='unknown'`)
  - Collect events (fees): ✅ (9 events deze week)
  - Increase/Decrease events: ✅
- **Query:** Werkt met `PositionEvent` + `PositionTransfer`
- **Limitaties:** 
  - Veel posities hebben `pool='unknown'` → moet gefixt worden
  - Fees moeten berekend worden uit `amount0`/`amount1` in COLLECT events

#### ✅ **P&L Breakdown per Pool**
- **Status:** ⚠️ **Gedeeltelijk beschikbaar**
- **Data:**
  - Pool addresses: ✅ (maar veel `unknown`)
  - Token symbols: ✅ (via `Pool` table)
  - Event counts: ✅ (COLLECT, INCREASE, DECREASE)
- **Query:** Werkt maar geeft 0 resultaten omdat veel `pool='unknown'`
- **Fix nodig:** Pool attribution voor posities verbeteren

#### ✅ **Unclaimed Rewards**
- **Status:** ✅ **Beschikbaar** (via COLLECT events)
- **Data:**
  - Collect events: ✅ (9 events laatste 30 dagen)
  - Timestamps: ✅
- **Query:** Werkt
- **Limitaties:**
  - "Unclaimed" moet berekend worden door te vergelijken met laatste COLLECT vs huidige fees
  - Rewards (rFLR, APS, HLN) moeten uit `PoolIncentive` komen

---

### **B. Position Health & Range Status**

#### ⚠️ **Range Status & Efficiency**
- **Status:** ⚠️ **Gedeeltelijk beschikbaar**
- **Data:**
  - `tickLower`, `tickUpper`, `tick`: ✅ (in `PositionEvent`)
  - Range status berekening: ✅ (IN_RANGE/OUT_OF_RANGE)
- **Query:** SQL syntax error (moet gefixt worden)
- **Limitaties:**
  - Geen `analytics_position_snapshot` data (tabel is leeg)
  - % tijd in-range moet berekend worden uit PositionEvent history
  - Geen real-time snapshots

---

### **C. Peer Benchmarking**

#### ✅ **User Ranking per Pool**
- **Status:** ✅ **Beschikbaar**
- **Data:**
  - Collect events per LP: ✅
  - Pool averages: ✅
  - Total LPs per pool: ✅
- **Query:** Werkt
- **Limitaties:**
  - Veel posities hebben `pool='unknown'` → ranking werkt niet goed
  - Percentile ranking moet berekend worden

---

### **D. Trends & Progress**

#### ✅ **Week-over-Week Growth**
- **Status:** ✅ **Beschikbaar**
- **Data:**
  - Collect events deze week: ✅ (9)
  - Collect events vorige week: ✅ (0)
  - Growth percentage: ✅ (kan berekend worden)
- **Query:** Werkt
- **Limitaties:**
  - Alleen event counts, geen USD waardes
  - Fees moeten berekend worden uit amounts

---

### **E. Market Intelligence**

#### ⚠️ **Trending Pools**
- **Status:** ⚠️ **Gedeeltelijk beschikbaar**
- **Data:**
  - Pool metadata: ✅ (`Pool` table)
  - Event counts: ✅
- **Query:** Werkt maar geeft 0 resultaten (geen recente events in Pool table)
- **Limitaties:**
  - APR data niet direct beschikbaar (moet berekend worden)
  - TVL moet berekend worden uit positions

---

## ❌ ONTBREKENDE DATA

### **1. Fees in USD**
- **Probleem:** `PositionEvent` heeft `amount0`/`amount1` maar geen `feesUsd`
- **Oplossing:** Bereken fees uit COLLECT events × token prices (CoinGecko)

### **2. Unclaimed Fees Tracking**
- **Probleem:** Geen directe tracking van unclaimed fees
- **Oplossing:** Vergelijk laatste COLLECT event met huidige pool fees (via RPC call)

### **3. Rewards Tracking**
- **Probleem:** `PoolIncentive` table is leeg (0 rows)
- **Oplossing:** Data moet geïmporteerd worden of via RPC opgehaald worden

### **4. Position Snapshots**
- **Probleem:** `analytics_position_snapshot` is leeg (0 rows)
- **Oplossing:** Snapshot job moet draaien of we gebruiken PositionEvent history

### **5. Range Status History**
- **Probleem:** Geen historische snapshots voor % tijd in-range
- **Oplossing:** Bereken uit PositionEvent history (tick changes)

### **6. Pool Attribution**
- **Probleem:** Veel posities hebben `pool='unknown'`
- **Oplossing:** Backfill script moet draaien of NFPM.positions() RPC calls

---

## 📊 DATA COVERAGE SCORE

| Categorie | Beschikbaar | Gedeeltelijk | Missing | Score |
|-----------|-------------|--------------|---------|-------|
| **Performance** | 2 | 1 | 0 | 67% |
| **Position Health** | 0 | 1 | 1 | 33% |
| **Peer Benchmarking** | 1 | 0 | 0 | 100% |
| **Trends** | 1 | 0 | 0 | 100% |
| **Market Intelligence** | 0 | 1 | 0 | 50% |
| **TOTAL** | **4** | **3** | **1** | **70%** |

---

## 🎯 IMPLEMENTATIE PRIORITEITEN

### **P0 - Critical (voor MVP)**
1. ✅ **Position Ownership** - Werkt (via PositionTransfer)
2. ✅ **Event Counts** - Werkt (COLLECT, INCREASE, DECREASE)
3. ⚠️ **Pool Attribution** - Veel `unknown`, moet gefixt worden
4. ⚠️ **Fees Calculation** - Moet berekend worden uit amounts × prices

### **P1 - High (voor volledige rapport)**
1. ⚠️ **Range Status** - SQL query fix + berekening uit history
2. ⚠️ **Unclaimed Rewards** - Vergelijk laatste COLLECT vs huidige state
3. ⚠️ **Rewards Data** - Import PoolIncentive data of RPC calls

### **P2 - Medium (nice to have)**
1. ⚠️ **Position Snapshots** - Snapshot job implementeren
2. ⚠️ **APR Calculation** - Bereken uit fees + TVL
3. ⚠️ **Trending Pools** - Verbeter query met recente events

---

## ✅ CONCLUSIE

**70% van de benodigde data is beschikbaar** voor een basis user engagement rapport.

**Wat WEL kan:**
- ✅ Week performance (positions, events)
- ✅ Week-over-week growth
- ✅ User ranking (met beperkingen)
- ✅ Basic P&L (met berekeningen)

**Wat NOG NIET kan:**
- ❌ Exacte fees in USD (moet berekend worden)
- ❌ Unclaimed rewards tracking (moet geïmplementeerd worden)
- ❌ Range status history (moet berekend worden)
- ❌ Rewards data (PoolIncentive is leeg)

**Volgende stap:** Implementeer berekeningen voor fees, range status, en unclaimed rewards tracking.

