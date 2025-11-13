# Backfill Handover — ChatGPT

## Overzicht

De **Historical Backfill** functionaliteit is een éénmalige data enrichment pipeline die alle historische blockchain data verrijkt met extra informatie (pool attribution, fees USD, range status, APR, IL, etc.).

---

## Wat doet de Backfill?

De backfill draait **10 enrichment scripts** sequentieel om historische data te verrijken:

1. **APR Calculation** — Bereken APR voor pools (fees + incentives)
2. **Pool Volume** — Bereken 24h trading volume per pool
3. **Position Health** — Bereken position health metrics
4. **Pool Attribution** — Resolve `pool='unknown'` naar echte pool addresses
5. **Fees USD** — Bereken USD waarde van COLLECT events
6. **Range Status** — Bereken IN_RANGE/OUT_OF_RANGE status
7. **Impermanent Loss** — Bereken IL voor posities
8. **rFLR Vesting** — Bereken vested rFLR rewards
9. **Unclaimed Fees** — Track unclaimed fees per positie
10. **Position Snapshots** — Maak historische snapshots

**Doel:** Alle historische data heeft complete enrichment (niet alleen nieuwe data).

---

## API Endpoint

**`/api/admin/backfill`**

### GET — Status ophalen
```bash
GET /api/admin/backfill
```

**Response:**
```json
{
  "running": false,
  "startedAt": "2025-11-10T20:00:00.000Z",
  "currentProcess": "Pool Attribution",
  "completedProcesses": ["APR Calculation", "Pool Volume"],
  "failedProcesses": [],
  "progress": {
    "total": 10,
    "completed": 2,
    "failed": 0
  }
}
```

### POST — Start/Stop backfill
```bash
POST /api/admin/backfill
Content-Type: application/json

{
  "action": "start"  // of "stop"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Backfill started",
  "status": { ... }
}
```

---

## Code Locatie

**API Endpoint:**
- `pages/api/admin/backfill.ts` — Main handler

**Backfill Logic:**
- `pages/api/admin/backfill.ts` → `runBackfillAsync()` — Draait scripts sequentieel

**Enrichment Scripts:**
De backfill verwijst naar scripts in `scripts/` directory:
- `scripts/enrich-apr-calculation.ts` ⚠️ **MOGELIJK VERWIJDERD**
- `scripts/enrich-pool-volume.ts` ⚠️ **MOGELIJK VERWIJDERD**
- `scripts/enrich-position-health.ts` ⚠️ **MOGELIJK VERWIJDERD**
- `scripts/enrich-user-engagement-data.ts` ⚠️ **MOGELIJK VERWIJDERD** (pool attribution + fees USD)
- `scripts/enrich-range-status.ts` ⚠️ **MOGELIJK VERWIJDERD**
- `scripts/enrich-impermanent-loss.ts` ⚠️ **MOGELIJK VERWIJDERD**
- `scripts/enrich-rflr-vesting.ts` ⚠️ **MOGELIJK VERWIJDERD**
- `scripts/enrich-unclaimed-fees.ts` ⚠️ **MOGELIJK VERWIJDERD**
- `scripts/enrich-position-snapshots.ts` ⚠️ **MOGELIJK VERWIJDERD**

**⚠️ KRITIEK:** Veel enrichment scripts zijn mogelijk verwijderd tijdens refactoring. Check eerst of scripts bestaan voordat je backfill draait:

```bash
# Check welke scripts bestaan
ls scripts/enrich-*.ts

# Als scripts ontbreken:
# 1. Check git history voor verwijderde scripts
# 2. Of maak nieuwe scripts gebaseerd op oude implementatie
# 3. Of verwijder ontbrekende scripts uit backfill lijst
```

---

## Hoe werkt het?

### 1. Start Backfill
```typescript
// User klikt "Start Backfill" in dashboard
POST /api/admin/backfill { action: "start" }

// API:
// 1. Check of backfill al draait
// 2. Zet backfillStatus.running = true
// 3. Start runBackfillAsync() asynchroon (niet blocking)
// 4. Return direct met status
```

### 2. Script Execution
```typescript
// Voor elk script:
// 1. Update backfillStatus.currentProcess = script.name
// 2. Run: execAsync(script.cmd, { timeout: 3600000 })
// 3. Parse stdout voor resultaten
// 4. Update completedProcesses of failedProcesses
// 5. Update progress
```

### 3. Status Tracking
- **In-memory:** `backfillStatus` object (verliest status bij server restart)
- **Polling:** Dashboard pollt elke 10 seconden via `GET /api/admin/backfill`
- **Logging:** Console logs met `[backfill-api]` prefix

---

## Gebruik

### Via Dashboard
1. Ga naar `/admin/enrichment`
2. Scroll naar "Historical Backfill" sectie
3. Klik "Start Backfill"
4. Volg progress in real-time (auto-refresh elke 10s)

### Via API (curl)
```bash
# Start backfill
curl -X POST http://localhost:3000/api/admin/backfill \
  -H "Content-Type: application/json" \
  -d '{"action":"start"}'

# Check status
curl http://localhost:3000/api/admin/backfill

# Stop backfill
curl -X POST http://localhost:3000/api/admin/backfill \
  -H "Content-Type: application/json" \
  -d '{"action":"stop"}'
```

---

## Environment Variables

De backfill gebruikt deze environment variables:

- `DATABASE_URL` — PostgreSQL connection string (vereist)
- `ANKR_HTTP_URL` — ANKR RPC URL (optioneel, voor snellere event scanning)
- `FLARE_RPC_URL` — Fallback RPC URL
- `INDEXER_BLOCK_WINDOW` — Automatisch op 5000 gezet voor ANKR
- `NODE_ENV` — production/development

**Scripts krijgen:**
```typescript
env: {
  ...process.env,
  INDEXER_BLOCK_WINDOW: '5000',
  NODE_ENV: process.env.NODE_ENV || 'production',
}
```

---

## Bekende Issues & Limitaties

### 1. In-Memory Status (Verliest bij restart)
**Probleem:** `backfillStatus` is in-memory, verliest status bij server restart.

**Impact:** Als server herstart tijdens backfill, status is weg.

**Workaround:** 
- Check logs voor laatste script
- Herstart backfill (scripts zijn idempotent, skip duplicates)

**Toekomstige fix:** Gebruik database of Redis voor persistent status.

---

### 2. Script Timeout (1 uur per script)
**Probleem:** Elke script heeft timeout van 1 uur (`3600000` ms).

**Impact:** Grote scripts kunnen timeout krijgen.

**Workaround:**
- Verhoog `timeout` in `runBackfillAsync()`
- Of split scripts in kleinere batches

---

### 3. Missing Scripts ⚠️ **WAARSCHIJNLIJK ACTIEF PROBLEEM**
**Probleem:** Veel enrichment scripts zijn mogelijk verwijderd tijdens refactoring.

**Check:**
```bash
# Check welke scripts bestaan
ls scripts/enrich-*.ts

# Als geen scripts gevonden worden:
# Scripts zijn verwijderd en moeten opnieuw gemaakt worden
```

**Fix Opties:**
1. **Herstel scripts uit git history:**
   ```bash
   git log --all --full-history -- scripts/enrich-*.ts
   git checkout <commit-hash> -- scripts/enrich-*.ts
   ```

2. **Verwijder ontbrekende scripts uit backfill:**
   - Edit `pages/api/admin/backfill.ts`
   - Verwijder scripts die niet bestaan uit `scripts` array

3. **Maak nieuwe scripts:**
   - Gebaseerd op oude implementatie
   - Of gebruik materialized views waar mogelijk (sneller)

---

### 4. Prisma Client Generation
**Probleem:** Backfill probeert `npx prisma generate` te draaien (kan falen).

**Impact:** Scripts kunnen falen als Prisma client niet beschikbaar is.

**Fix:** Zorg dat `npx prisma generate` werkt, of skip deze stap.

---

### 5. Body Parsing Error
**Probleem:** `req.body` parsing kan falen als JSON invalid is.

**Fix:** Body parsing is al gefixt met try-catch, maar check logs voor details.

---

## Debugging

### Check Logs
```bash
# Railway logs
railway logs --service your-service-name

# Local logs
# Check console output voor [backfill-api] prefix
```

### Test Script Individueel
```bash
# Test één script
npx tsx scripts/enrich-apr-calculation.ts --limit=500

# Check output
# Als script faalt, fix script eerst voordat je backfill draait
```

### Check Status via API
```bash
# Get status
curl http://localhost:3000/api/admin/backfill | jq

# Check completed/failed processes
# Failed processes bevatten error messages
```

### Database Check
```sql
-- Check of enrichment werkt
SELECT 
  COUNT(*) FILTER (WHERE pool = 'unknown') as unknown_pools,
  COUNT(*) as total_positions
FROM "PositionEvent";

-- Check fees USD
SELECT 
  COUNT(*) FILTER (WHERE "usdValue" IS NULL) as without_usd,
  COUNT(*) as total
FROM "PositionEvent"
WHERE "eventType" = 'COLLECT';
```

---

## Error Handling

### Script Failures
- Script failures worden gelogd maar stoppen niet de hele backfill
- Failed scripts worden toegevoegd aan `failedProcesses` array
- Andere scripts blijven draaien

### Fatal Errors
- Als `runBackfillAsync()` zelf faalt, wordt error gelogd
- `backfillStatus.running` wordt op `false` gezet
- Error wordt toegevoegd aan `failedProcesses`

### User Stop
- User kan backfill stoppen via "Stop Backfill" knop
- `backfillStatus.running` wordt op `false` gezet
- Huidige script wordt afgemaakt, volgende scripts worden geskipt

---

## Best Practices

### 1. Check Scripts Eerst
```bash
# Verifieer dat alle scripts bestaan
for script in scripts/enrich-*.ts; do
  echo "Checking $script..."
  test -f "$script" || echo "MISSING: $script"
done
```

### 2. Test Kleine Batch Eerst
```bash
# Test met kleine limit
npx tsx scripts/enrich-apr-calculation.ts --limit=10

# Als werkt, verhoog limit
```

### 3. Monitor Progress
- Check dashboard elke paar minuten
- Check logs voor errors
- Check database voor resultaten

### 4. Idempotent Scripts
- Scripts moeten idempotent zijn (veilig om meerdere keren te draaien)
- Check voor duplicates voordat je insert
- Gebruik `ON CONFLICT` in SQL waar mogelijk

---

## Toekomstige Verbeteringen

### 1. Persistent Status Storage
- Gebruik database tabel voor backfill status
- Overleeft server restarts
- Kan status queryen via SQL

### 2. Parallel Execution
- Draai scripts parallel waar mogelijk
- Alleen sequentieel waar dependencies zijn

### 3. Resume Capability
- Resume van laatste completed script
- Skip al completed scripts

### 4. Better Error Reporting
- Detailed error messages
- Stack traces voor debugging
- Email/notification bij failures

### 5. Progress Tracking per Script
- Track progress binnen script (niet alleen completion)
- Bijv. "Processing 500/5000 positions..."

---

## Related Documentation

- `PROJECT_STATE.md` — Overall project status
- `ENRICHMENT_STATUS.md` — Wat is er al ge-enriched
- `ANKR_BACKFILL_PLAN.md` — ANKR backfill strategie
- `docs/CRON_ENRICHMENT_EXPLAINED.md` — Hourly enrichment cron

---

## Contact & Support

Voor vragen of issues:
1. Check logs eerst (`[backfill-api]` prefix)
2. Test scripts individueel
3. Check database voor resultaten
4. Check PROJECT_STATE.md voor updates

**Laatste update:** 2025-11-10

