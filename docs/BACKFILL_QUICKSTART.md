# 🚀 Historical Backfill Quick Start

## Optie 1: Lokaal Draaien (Development/Testing)

### Stap 1: Environment Variables Instellen

```bash
# In je terminal:
export ANKR_HTTP_URL=https://rpc.ankr.com/flare/YOUR_ANKR_KEY
export INDEXER_BLOCK_WINDOW=5000
export DATABASE_URL=postgresql://...  # (al ingesteld via .env.local)
```

Of voeg toe aan `.env.local`:
```bash
ANKR_HTTP_URL=https://rpc.ankr.com/flare/YOUR_ANKR_KEY
INDEXER_BLOCK_WINDOW=5000
```

### Stap 2: Script Starten

```bash
npm run enrichment:backfill-ankr
```

**Verwachte output:**
```
✅ ANKR RPC detected: https://rpc.ankr.com/flare/...
🚀 ANKR HISTORICAL BACKFILL - Full History Enrichment
📅 Started: 2025-01-XX...
🌐 RPC: ANKR (5000 block batches)
💰 Estimated ANKR cost: ~$0.14 USD

🔴 Running: APR Calculation...
✅ APR Calculation complete in 300s
...
```

### Stap 3: Monitoren

- Script output in terminal
- Check `/admin/enrichment` dashboard
- Monitor database queries

---

## Optie 2: Railway Worker Service (Production - Aanbevolen)

### Stap 1: Maak Nieuwe Railway Service

1. Ga naar Railway Dashboard
2. Klik "New Project" → "Empty Project"
3. Of voeg service toe aan bestaand project

### Stap 2: Connect GitHub Repo

1. Kies "Deploy from GitHub repo"
2. Selecteer je LiquiLab repository
3. Wacht tot build compleet is

### Stap 3: Environment Variables

In Railway service → Variables tab, voeg toe:

```bash
ANKR_HTTP_URL=https://rpc.ankr.com/flare/YOUR_ANKR_KEY
INDEXER_BLOCK_WINDOW=5000
DATABASE_URL=postgresql://...  # (deel met main service)
```

### Stap 4: Configureer Service

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
npm run enrichment:backfill-ankr
```

### Stap 5: Start Service

1. Klik "Deploy" of "Start"
2. Monitor logs in Railway Dashboard
3. Wacht tot backfill compleet is (~20 uur)
4. **Stop service** na backfill om kosten te besparen

---

## ⏱️ Verwachte Tijd

- **Totaal:** ~15-20 uur
- **Snelle processen:** ~20 minuten (APR, Volume, Health)
- **Langzame processen:** ~7-14 uur (Pool Attribution, Range Status)

---

## 📊 Monitoring

### Railway Logs
- Railway Dashboard → Service → Logs
- Real-time output van script
- Check voor errors

### Admin Dashboard
- Ga naar: `https://your-app.railway.app/admin/enrichment`
- Zie progress van alle enrichment processen

### Database Queries
```sql
-- Check pool attribution
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN pool != 'unknown' THEN 1 END) as resolved,
  ROUND(100.0 * COUNT(CASE WHEN pool != 'unknown' THEN 1 END) / COUNT(*), 2) as pct
FROM "PositionEvent"
WHERE "pool" IS NOT NULL;

-- Check fees USD
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN "usdValue" IS NOT NULL THEN 1 END) as enriched,
  ROUND(100.0 * COUNT(CASE WHEN "usdValue" IS NOT NULL THEN 1 END) / COUNT(*), 2) as pct
FROM "PositionEvent"
WHERE "eventType" = 'COLLECT';
```

---

## ⚠️ Troubleshooting

### ANKR RPC Not Detected
```
❌ ANKR RPC not detected!
```
**Fix:** Check `ANKR_HTTP_URL` environment variable is correct

### Database Connection Failed
```
Error: could not connect to database
```
**Fix:** Check `DATABASE_URL` is correct and accessible

### Script Timeout
```
Error: Command timed out
```
**Fix:** Scripts hebben timeouts per proces. Als een proces faalt, kan je het individueel opnieuw draaien:
```bash
npm run enrich:data -- --skip-fees --limit=5000
```

### Rate Limiting
```
Error: 429 Too Many Requests
```
**Fix:** ANKR heeft hoge rate limits, maar als dit voorkomt, wacht even en probeer opnieuw

---

## 💡 Tips

1. **Start met kleine batch** (test eerst):
   ```bash
   npm run enrich:data -- --skip-fees --limit=100
   ```

2. **Monitor eerste proces** voordat je volledige backfill draait

3. **Script kan gestopt worden** en later hervat (progress wordt opgeslagen)

4. **Failed scripts kunnen opnieuw gedraaid worden** zonder impact op succesvolle scripts

---

## ✅ Na Backfill

1. **Stop Railway worker service** (als gebruikt)
2. **Check admin dashboard** voor completion percentages
3. **Verify data** met database queries
4. **Start hourly cron** voor nieuwe data (zie `docs/ENRICHMENT_SETUP_GUIDE.md`)

---

## 🎯 Klaar om te Starten?

**Lokaal:**
```bash
export ANKR_HTTP_URL=https://rpc.ankr.com/flare/YOUR_KEY
npm run enrichment:backfill-ankr
```

**Railway:**
- Volg Optie 2 hierboven
- Start service en monitor logs

**Vragen?** Check `docs/ENRICHMENT_SETUP_GUIDE.md` voor meer details.

