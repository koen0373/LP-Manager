# Enrichment Architectuur Alternatieven

## Huidige Situatie

**Indexer (simpel):**
- Haalt raw blockchain events op (MINT, COLLECT, etc.)
- Schrijft naar database (PositionEvent, PositionTransfer)
- Dat is alles! ✅

**Enrichment (complex):**
- 10 verschillende scripts
- Cron job die alles sequentieel draait
- Veel database queries
- Veel 502 errors

## Alternatieve Oplossingen

### **Optie 1: Database Materialized Views (AANBEVOLEN) ⭐**

**Voordeel:** Alles in database, geen scripts nodig, super snel

```sql
-- Voorbeeld: Range Status berekenen in database
CREATE MATERIALIZED VIEW position_range_status AS
SELECT 
  pe."tokenId",
  pe."pool",
  pe."tickLower",
  pe."tickUpper",
  p."tick" as current_tick,
  CASE 
    WHEN p."tick" >= pe."tickLower" AND p."tick" < pe."tickUpper" 
    THEN 'IN_RANGE' 
    ELSE 'OUT_OF_RANGE' 
  END as range_status
FROM "PositionEvent" pe
JOIN "Pool" p ON p.address = pe."pool"
WHERE pe."tickLower" IS NOT NULL;

-- Refresh elke 5 minuten via cron
REFRESH MATERIALIZED VIEW CONCURRENTLY position_range_status;
```

**Voordelen:**
- ✅ Geen scripts nodig
- ✅ Super snel (database doet het werk)
- ✅ Geen 502 errors (geen API calls)
- ✅ Automatisch geïndexeerd

**Nadelen:**
- ❌ Kan niet alle berekeningen (bijv. CoinGecko API calls)
- ❌ Moet refreshen (niet real-time)

---

### **Optie 2: On-Demand Enrichment (Lazy Loading)**

**Voordeel:** Alleen enrich wanneer gebruiker data opvraagt

```typescript
// In API route (bijv. /api/positions)
export default async function handler(req, res) {
  const positions = await getPositions();
  
  // Enrich alleen wat nodig is voor deze request
  const enriched = await Promise.all(
    positions.map(async (pos) => {
      // Check cache eerst
      const cached = await getCachedEnrichment(pos.id);
      if (cached) return { ...pos, ...cached };
      
      // Enrich on-demand
      const enrichment = await enrichPosition(pos);
      await cacheEnrichment(pos.id, enrichment, 3600); // Cache 1 uur
      return { ...pos, ...enrichment };
    })
  );
  
  return res.json(enriched);
}
```

**Voordelen:**
- ✅ Geen cron nodig
- ✅ Alleen wat nodig is wordt berekend
- ✅ Kan caching gebruiken
- ✅ Geen 502 errors (geen bulk processing)

**Nadelen:**
- ❌ Eerste request kan langzaam zijn
- ❌ Moeilijk voor dashboards die alles nodig hebben

---

### **Optie 3: Database Triggers + Background Jobs**

**Voordeel:** Automatisch enrichment wanneer nieuwe data binnenkomt

```sql
-- Trigger wanneer nieuwe PositionEvent wordt toegevoegd
CREATE OR REPLACE FUNCTION trigger_enrichment()
RETURNS TRIGGER AS $$
BEGIN
  -- Voeg toe aan enrichment queue (Redis/BullMQ)
  PERFORM pg_notify('enrichment_queue', json_build_object(
    'type', 'position_event',
    'tokenId', NEW."tokenId",
    'pool', NEW."pool"
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER position_event_enrichment
AFTER INSERT ON "PositionEvent"
FOR EACH ROW
EXECUTE FUNCTION trigger_enrichment();
```

**Voordelen:**
- ✅ Real-time enrichment
- ✅ Automatisch, geen cron nodig
- ✅ Kan queue gebruiken voor rate limiting

**Nadelen:**
- ❌ Complexer (Redis/BullMQ nodig)
- ❌ Kan overload veroorzaken bij veel events

---

### **Optie 4: Simpler Cron (Huidige + Verbeteringen)**

**Voordeel:** Houdt huidige architectuur maar simpeler

**Problemen nu:**
- 10 scripts sequentieel = langzaam
- Geen error recovery
- Geen prioriteit

**Verbeteringen:**

```typescript
// Simpler cron met:
// 1. Parallel processing (niet sequentieel)
// 2. Prioriteiten (kritiek eerst)
// 3. Error recovery (retry failed items)

const ENRICHMENT_JOBS = [
  { name: 'pool-attribution', priority: 1, parallel: true },
  { name: 'fees-usd', priority: 1, parallel: true },
  { name: 'range-status', priority: 2, parallel: true },
  // ... etc
];

// Run parallel waar mogelijk
await Promise.allSettled(
  ENRICHMENT_JOBS
    .filter(job => job.priority === 1)
    .map(job => runEnrichment(job))
);
```

**Voordelen:**
- ✅ Houdt huidige setup
- ✅ Sneller (parallel)
- ✅ Betere error handling

**Nadelen:**
- ❌ Nog steeds cron-based
- ❌ Nog steeds scripts nodig

---

### **Optie 5: Hybrid: Database Views + On-Demand**

**Voordeel:** Beste van beide werelden

```typescript
// 1. Simpele berekeningen in database (materialized views)
// 2. Complexe berekeningen on-demand (API calls)

// Database view voor range status
const rangeStatus = await db.query(`
  SELECT * FROM position_range_status_mv 
  WHERE "tokenId" = $1
`);

// On-demand voor CoinGecko prices
if (!rangeStatus.priceUsd) {
  const price = await fetchCoinGeckoPrice(token);
  await updateCache(token, price);
}
```

**Voordelen:**
- ✅ Snel voor simpele berekeningen
- ✅ Flexibel voor complexe berekeningen
- ✅ Geen bulk processing nodig

---

## Mijn Aanbeveling

### **Korte termijn (nu):**
1. **Database Materialized Views** voor simpele berekeningen:
   - Range Status (tick comparison)
   - Position counts
   - Pool statistics

2. **On-Demand** voor complexe berekeningen:
   - CoinGecko prices (cache 1 uur)
   - rFLR vesting (cache 24 uur)
   - APR (cache 1 uur)

### **Lange termijn:**
- **Event-driven queue** voor real-time enrichment
- **Database triggers** voor automatische queue updates

## Implementatie Plan

**Stap 1:** Maak materialized views voor simpele berekeningen
**Stap 2:** Verwijder cron scripts die alleen database queries doen
**Stap 3:** Implementeer on-demand enrichment met caching
**Stap 4:** Monitor performance en pas aan

**Resultaat:**
- ✅ Geen 502 errors meer
- ✅ Sneller (database is sneller dan scripts)
- ✅ Simpeler (minder code)
- ✅ Goedkoper (minder Railway compute)

