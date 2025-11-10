# Enrichment Roadmap voor Hourly Cron Job

## ✅ GEÏMPLEMENTEERD (6 processen)

1. Pool Attribution (500/hour)
2. Fees USD Calculation (5000/hour)
3. Range Status (200/hour)
4. Position Snapshots (100/hour)
5. APR Calculation (100/hour) - Fees + Total
6. Impermanent Loss (200/hour) - Met incentives

**Totaal:** ~6,100 items/hour

---

## 🔴 VOLGENDE STAP: 3 HOOG PRIORITEIT

### 7. Unclaimed Fees Tracking (100/hour)
**Waarom:** Direct actionable - "Claim $XX fees!"
**Implementatie:** RPC call naar NFPM.positions() → tokensOwed

### 8. Position Health Metrics (200/hour)
**Waarom:** Voor "Position Health" sectie in rapport
**Implementatie:** Bereken % tijd in-range uit snapshots/history

### 9. Pool Volume Metrics (50/hour)
**Waarom:** Voor "Trending Pools" en market intelligence
**Implementatie:** Scan Swap events laatste 24h per pool

**Totaal na toevoeging:** ~6,450 items/hour ✅

---

## 🟡 MEDIUM PRIORITEIT (Later)

10. Wallet Aggregation Metrics (500/hour)
11. Peer Benchmarking (100/hour)

## 🟢 LAAG PRIORITEIT (Nice to Have)

12. Pool TVL Real-time Updates (50/hour)
13. Fee Tier Analysis (20/hour)
