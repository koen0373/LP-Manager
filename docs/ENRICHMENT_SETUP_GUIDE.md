# 🚀 Enrichment Setup Guide - Actieplan

## ✅ Wat We Hebben

1. **Hourly Enrichment Cron** (`pages/api/cron/enrichment-hourly.ts`)
   - Enriched nieuwe data elke uur
   - 10 enrichment processen
   - Klaar voor gebruik

2. **ANKR Historical Backfill** (`scripts/enrichment-backfill-ankr.ts`)
   - Enriched alle historische data eenmalig
   - Gebruikt ANKR's 5000 blokken batches
   - Klaar voor gebruik

3. **Kosten**
   - Railway: ~$0.005 (20 uur compute)
   - ANKR: ~$0.14 (volledige backfill)
   - **TOTAAL: ~$0.15** ✅

---

## 🎯 Actieplan

### STAP 1: Environment Variables (Railway)

Zet deze environment variables in Railway:

```bash
# ANKR RPC (vereist voor backfill)
ANKR_HTTP_URL=https://rpc.ankr.com/flare/YOUR_KEY

# Block window voor ANKR (5000 blokken)
INDEXER_BLOCK_WINDOW=5000

# Cron secret voor hourly enrichment
CRON_SECRET=your-random-secret-key-here

# Database (al ingesteld)
DATABASE_URL=postgresql://...
```

**Waar te vinden:**
- Railway Dashboard → Your Service → Variables tab
- Voeg elke variable toe via "New Variable"

---

### STAP 2: Hourly Cron Setup (Railway)

**Optie A: Railway Cron Service (Aanbevolen)**

1. Maak nieuwe Railway service: "Enrichment Cron"
2. Connect aan zelfde GitHub repo
3. Set environment variables (zie STAP 1)
4. Set **Start Command:**
   ```bash
   npm run start
   ```
5. Maak **Cron Job** in Railway:
   - **Schedule:** `0 * * * *` (elke uur)
   - **Command:**
     ```bash
     curl -X POST $RAILWAY_PUBLIC_DOMAIN/api/cron/enrichment-hourly \
       -H "Authorization: Bearer $CRON_SECRET"
     ```

**Optie B: External Cron (bijv. cron-job.org)**

1. Maak account op cron-job.org
2. Maak nieuwe cron job:
   - **URL:** `https://your-app.railway.app/api/cron/enrichment-hourly`
   - **Schedule:** Elke uur
   - **Headers:** `Authorization: Bearer YOUR_CRON_SECRET`
   - **Method:** POST

---

### STAP 3: Historical Backfill (Eenmalig)

**Optie A: Lokaal Draaien**

```bash
# Set environment variables
export ANKR_HTTP_URL=https://rpc.ankr.com/flare/YOUR_KEY
export INDEXER_BLOCK_WINDOW=5000

# Run backfill
npm run enrichment:backfill-ankr
```

**Optie B: Railway Worker Service (Aanbevolen)**

1. Maak nieuwe Railway service: "Enrichment Backfill"
2. Connect aan zelfde GitHub repo
3. Set environment variables:
   - `ANKR_HTTP_URL`
   - `INDEXER_BLOCK_WINDOW=5000`
   - `DATABASE_URL` (deel met main service)
4. Set **Start Command:**
   ```bash
   npm run enrichment:backfill-ankr
   ```
5. **Start service** → Wacht tot backfill compleet is (~20 uur)
6. **Stop service** na backfill (om kosten te besparen)

**Verwachte Output:**
```
🚀 ANKR HISTORICAL BACKFILL - Full History Enrichment
📅 Started: 2025-01-XX...
🌐 RPC: ANKR (5000 block batches)
💰 Estimated ANKR cost: ~$0.14 USD

🔴 Running: APR Calculation...
✅ APR Calculation complete in 300s
...
```

---

### STAP 4: Monitoring

**Admin Dashboard:**
- Ga naar: `https://your-app.railway.app/admin/enrichment`
- Check progress van alle enrichment processen
- Zie real-time statistieken

**Railway Logs:**
- Railway Dashboard → Your Service → Logs
- Monitor voor errors of warnings
- Check execution time per proces

**Database Check:**
```sql
-- Check pool attribution progress
SELECT COUNT(*) as total, 
       COUNT(CASE WHEN pool != 'unknown' THEN 1 END) as resolved
FROM "PositionEvent"
WHERE "pool" IS NOT NULL;

-- Check fees USD progress
SELECT COUNT(*) as total,
       COUNT(CASE WHEN "usdValue" IS NOT NULL THEN 1 END) as enriched
FROM "PositionEvent"
WHERE "eventType" = 'COLLECT';
```

---

## 📊 Verwachte Resultaten

### Na Hourly Cron (elke uur):
- 500 nieuwe posities get enriched (Pool Attribution)
- 5000 nieuwe events get enriched (Fees USD)
- 200 posities get enriched (Range Status)
- etc.

### Na Historical Backfill (eenmalig):
- Alle 25,000 posities get enriched (Pool Attribution)
- Alle 111,000 events get enriched (Fees USD)
- Alle historische data get enriched

---

## ⚠️ Troubleshooting

**Problem: ANKR RPC not detected**
```
❌ ANKR RPC not detected!
```
**Solution:** Check `ANKR_HTTP_URL` environment variable

**Problem: Cron returns 401 Unauthorized**
```
{"error": "Unauthorized"}
```
**Solution:** Check `CRON_SECRET` matches in request header

**Problem: Script timeout**
```
Error: Command timed out
```
**Solution:** Increase timeout in script or split in smaller batches

**Problem: Database connection failed**
```
Error: could not connect to database
```
**Solution:** Check `DATABASE_URL` is correct and accessible

---

## 💡 Tips

1. **Start met Hourly Cron eerst**
   - Dit zorgt dat nieuwe data altijd enriched wordt
   - Backfill kan later gedraaid worden

2. **Monitor de eerste paar runs**
   - Check logs voor errors
   - Verify data in database
   - Adjust batch sizes indien nodig

3. **Backfill kan in delen**
   - Scripts kunnen individueel gedraaid worden
   - Failed scripts kunnen opnieuw gedraaid worden
   - Progress wordt opgeslagen in database

4. **Kosten minimaliseren**
   - Stop Railway worker service na backfill
   - Hourly cron draait op main service (geen extra kosten)
   - ANKR kosten zijn verwaarloosbaar (~$0.14)

---

## ✅ Checklist

- [ ] Environment variables ingesteld in Railway
- [ ] Hourly cron job geconfigureerd
- [ ] Historical backfill script getest (lokaal of Railway)
- [ ] Monitoring dashboard gecheckt
- [ ] Database queries getest
- [ ] Logs gemonitord voor errors

---

## 🎉 Klaar!

Na deze stappen heb je:
- ✅ Automatische hourly enrichment voor nieuwe data
- ✅ Volledige historische data enriched
- ✅ Monitoring dashboard voor progress
- ✅ Totale kosten: ~$0.15 voor volledige backfill

**Vragen?** Check de logs of de admin dashboard voor meer details.

