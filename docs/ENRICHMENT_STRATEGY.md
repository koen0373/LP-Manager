# Enrichment Strategy: Pre-computed vs On-Demand

## 💡 Hybride Aanpak (Aanbevolen)

### 🔴 KRITIEK - Moet Pre-computed zijn

**1. Pool Attribution**
- **Waarom:** Zonder pool address kunnen we niets tonen
- **Snelheid:** RPC call duurt ~200ms per positie
- **Impact:** 100 posities = 20 seconden wachttijd ❌
- **Beslissing:** ✅ **Backfill nodig**

**2. Fees USD Calculation**
- **Waarom:** CoinGecko rate limit (50 calls/min) maakt real-time onmogelijk
- **Snelheid:** Batch processing nodig, kan niet per request
- **Impact:** 100 posities = minuten wachttijd ❌
- **Beslissing:** ✅ **Backfill nodig**

---

### 🟡 BELANGRIJK - Kan On-Demand met Caching

**3. Range Status**
- **Snelheid:** 2 RPC calls per positie (~400ms totaal)
- **Impact:** 10 posities = 4 seconden (acceptabel met cache)
- **Cache:** 5 minuten
- **Beslissing:** ⚠️ **Hybride:** Backfill voor bestaande, on-demand voor nieuwe

**4. APR Calculation**
- **Snelheid:** SQL query alleen (~50ms)
- **Impact:** Verwaarloosbaar
- **Cache:** 1 uur
- **Beslissing:** ✅ **On-demand is prima**

**5. Pool Volume**
- **Snelheid:** SQL query alleen (~50ms)
- **Impact:** Verwaarloosbaar
- **Cache:** 15 minuten
- **Beslissing:** ✅ **On-demand is prima**

**6. Position Health**
- **Snelheid:** SQL query alleen (~100ms)
- **Impact:** Verwaarloosbaar
- **Cache:** 1 uur
- **Beslissing:** ✅ **On-demand is prima**

---

### 🟢 OPTIONEEL - Kan On-Demand

**7. rFLR Vesting**
- **Snelheid:** API call per positie (~100ms)
- **Impact:** 10 posities = 1 seconde (acceptabel)
- **Cache:** 1 uur (vesting verandert langzaam)
- **Beslissing:** ✅ **On-demand met cache**

**8. Unclaimed Fees**
- **Snelheid:** RPC call per positie (~200ms)
- **Impact:** 10 posities = 2 seconden (acceptabel)
- **Cache:** 5 minuten
- **Beslissing:** ✅ **On-demand met cache**

**9. Impermanent Loss**
- **Snelheid:** Complexe berekening met RPC calls (~500ms)
- **Impact:** 10 posities = 5 seconden (acceptabel met cache)
- **Cache:** 15 minuten
- **Beslissing:** ✅ **On-demand met cache**

**10. Position Snapshots**
- **Snelheid:** RPC + price calls (~300ms)
- **Impact:** Voor historische data, niet kritiek
- **Cache:** 1 uur
- **Beslissing:** ✅ **On-demand of achtergrond job**

---

## 📊 Aanbevolen Strategie

### Fase 1: Minimale Backfill (Kritiek)
```bash
# Alleen deze 2 zijn echt nodig:
npm run enrich:data -- --skip-fees --limit=25000  # Pool Attribution
npm run enrich:data -- --skip-pool --limit=111000   # Fees USD
```
**Tijd:** ~13 uur

### Fase 2: On-Demand voor Rest
- Range Status: Bereken bij eerste request, cache 5 min
- APR, Volume, Health: Real-time SQL queries
- rFLR, Unclaimed Fees, IL: Bereken bij request, cache resultaten

### Fase 3: Incrementele Enrichment
- Hourly cron blijft draaien voor nieuwe data
- On-demand vult aan voor data die cron nog niet heeft bereikt

---

## ⚡ Performance Impact

### Scenario: Gebruiker logt in met 50 posities

**Met volledige backfill:**
- API response: ~200ms (alleen database queries)
- ✅ Snelle user experience

**Met on-demand (geen backfill):**
- Pool Attribution: 50 × 200ms = 10 seconden ❌
- Fees USD: Batch processing nodig, kan niet real-time ❌
- Range Status: 50 × 400ms = 20 seconden ❌
- **Totaal:** ~30+ seconden wachttijd ❌

**Met hybride (minimale backfill + on-demand):**
- Pool Attribution: Pre-computed ✅
- Fees USD: Pre-computed ✅
- Range Status: On-demand met cache (eerste keer 20s, daarna instant) ✅
- Rest: On-demand met cache ✅
- **Totaal:** ~200ms (na eerste load) ✅

---

## 💡 Conclusie

**Minimale Backfill nodig voor:**
1. ✅ Pool Attribution (kritiek)
2. ✅ Fees USD (kritiek)

**Rest kan on-demand:**
- Met caching voor goede performance
- Hourly cron vult aan voor nieuwe data
- Beste van beide werelden: snel + flexibel
