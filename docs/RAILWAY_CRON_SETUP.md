# ⏰ Railway Cron Setup - Wekelijks Rapport

## Quick Setup Guide

### Stap 1: Ga naar Railway Dashboard

1. Open: https://railway.app/dashboard
2. Selecteer je **LiquiLab** project
3. Klik op de **"Cron"** tab (of "Add New" → "Cron Job")

---

### Stap 2: Create Cron Job

**Basic Settings:**

| Field | Value |
|-------|-------|
| **Name** | `Weekly Report Generator` |
| **Schedule** | `0 10 * * 1` |
| **Command** | `npm run report:all` |
| **Service** | Link to `liquilab-lp-manager` service |

---

### Stap 3: Environment Variables

Zorg dat deze variabelen beschikbaar zijn in je Cron service:

```bash
# Required
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Optional (for DefiLlama API)
# (geen extra keys nodig, publieke API)
```

**Link Postgres Database:**
- In Railway dashboard, klik "Variables"
- Klik "+ Reference" → Select "Postgres" service
- Dit linkt automatisch `DATABASE_URL`

---

### Stap 4: Test Cron Job

**Handmatig triggeren:**
1. Ga naar Cron Job in Railway
2. Klik "Run Now" / "Trigger Manually"
3. Check logs voor output

**Expected Output:**
```
🚀 LiquiLab Weekly Report Generator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Generating report for Week XX, Month YYYY

📊 Fetching current data from database...
💰 Fetching TVL data from DefiLlama...
📝 Generating markdown report...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ REPORT GENERATED SUCCESSFULLY

📄 File: /app/docs/research/weekly/Cross-DEX-Report-YYYY-Wxx.md
📊 Total Positions: 50,421
💰 Total TVL: $58.9M
👥 Cross-DEX Users: 761
```

---

### Stap 5: Verify Files

**Check gegenereerde bestanden:**

In Railway console, run:
```bash
ls -lh docs/research/weekly/
```

**Verwachte output:**
```
Cross-DEX-Report-2025-W03.md
Cross-DEX-Report-2025-W03.html
W03-social/
  ├── linkedin.txt
  ├── twitter-thread.txt
  ├── tweet-1.txt ... tweet-7.txt
  ├── instagram.txt
  └── reddit.txt
```

---

## 📅 Cron Schedule Uitleg

```
0 10 * * 1
│ │  │ │ │
│ │  │ │ └─── Dag van week (0=Zondag, 1=Maandag, ..., 6=Zaterdag)
│ │  │ └───── Maand (1-12)
│ │  └─────── Dag van maand (1-31)
│ └────────── Uur (0-23, UTC tijd!)
└──────────── Minuut (0-59)
```

**Belangrijk:** Railway draait in **UTC tijd**!

Voor **Maandag 10:00 CET** gebruik je:
- **Winter (CET = UTC+1):** `0 9 * * 1` (9:00 UTC = 10:00 CET)
- **Zomer (CEST = UTC+2):** `0 8 * * 1` (8:00 UTC = 10:00 CEST)

**Aanbeveling:** Gebruik `0 9 * * 1` (altijd 9:00 UTC)
- Winter: 10:00 CET ✅
- Zomer: 11:00 CEST (acceptabel)

---

## 🔔 Alternative Schedules

### Dagelijks om 10:00 CET
```
0 9 * * *
```

### Elke Maandag & Vrijdag om 10:00 CET
```
0 9 * * 1,5
```

### Elke 1e dag van de maand om 10:00 CET
```
0 9 1 * *
```

### Twee keer per week (Maandag & Donderdag)
```
0 9 * * 1,4
```

---

## 📥 Download Reports from Railway

### Methode 1: Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Download bestanden
railway run cat docs/research/weekly/Cross-DEX-Report-2025-W03.md > local-report.md
```

### Methode 2: Add API Endpoint

Voeg een API route toe om rapporten te downloaden:

**File:** `pages/api/reports/[week].ts`

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { week } = req.query;
  
  const reportPath = path.join(
    process.cwd(),
    'docs/research/weekly',
    `Cross-DEX-Report-2025-W${week}.md`
  );
  
  if (!fs.existsSync(reportPath)) {
    return res.status(404).json({ error: 'Report not found' });
  }
  
  const content = fs.readFileSync(reportPath, 'utf8');
  res.status(200).send(content);
}
```

**Usage:**
```bash
curl https://app.liquilab.io/api/reports/03 > report.md
```

---

## 🚨 Troubleshooting

### **Probleem: Cron draait niet**

**Check:**
1. Cron schedule correct? (UTC tijd!)
2. Environment variables linked?
3. Command correct? (`npm run report:all`)

**Debug:**
```bash
# In Railway console
which npm
npm --version
ls -la scripts/
cat scripts/weekly-report-workflow.sh
```

### **Probleem: Database connection error**

```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Test connection
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"PositionTransfer\";"
```

### **Probleem: Command not found**

```bash
# Check if scripts are present
ls -la scripts/generate-weekly-report.js
ls -la scripts/generate-social-media.js

# Check permissions
chmod +x scripts/weekly-report-workflow.sh
```

### **Probleem: Geen output bestanden**

**Mogelijke oorzaak:** Directory bestaat niet

**Fix:**
```bash
# In Railway console
mkdir -p docs/research/weekly
npm run report:all
```

---

## 📊 Monitor Cron Execution

### Railway Dashboard

1. Go to Cron Job
2. View "Logs" tab
3. Check execution history

### Log alle executions

**Update script om logs bij te houden:**

```javascript
// In generate-weekly-report.js, add at end:
const logEntry = {
  timestamp: new Date().toISOString(),
  week: weekInfo.week,
  year: weekInfo.year,
  positions: data.positionStats.total_positions,
  tvl: tvl.totalTVL,
  success: true
};

fs.appendFileSync(
  path.join(process.cwd(), 'data/report-execution-log.jsonl'),
  JSON.stringify(logEntry) + '\n'
);
```

---

## ✅ Post-Cron Workflow

**Na elke automatische run:**

1. **Download Bestanden (weekly)**
   - Download markdown, HTML, social content
   - Export HTML naar PDF (Cmd+P)

2. **Post op Social Media**
   - LinkedIn (direct copy-paste)
   - Twitter thread (7 tweets)
   - Instagram (met visual)
   - Reddit (r/FlareNetwork)

3. **Upload naar Website**
   - PDF → `liquilab.io/research/weekly/`
   - Update "Latest Report" link

4. **Track Metrics**
   - Views, downloads, engagement
   - Note voor volgende week

---

## 📞 Support

**Issues met Cron setup?**
- Check Railway docs: https://docs.railway.app/reference/cron-jobs
- Discord: #dev-support
- Deze guide: `docs/RAILWAY_CRON_SETUP.md`

---

**Setup Date:** 2025-11-09  
**Version:** 1.0  
**Maintainer:** LiquiLab Dev Team

