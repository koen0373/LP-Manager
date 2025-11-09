# 📊 Weekly Report Automation System

Complete geautomatiseerde workflow voor wekelijkse Cross-DEX analytics rapporten.

---

## 🎯 **Overzicht**

Dit systeem genereert elke week automatisch:
- ✅ **Markdown rapport** met actuele data uit de database
- ✅ **HTML versie** klaar voor PDF export
- ✅ **Social media content** voor LinkedIn, Twitter, Instagram, Reddit
- ✅ **Week-over-week trends** (vanaf week 2)

---

## 📁 **Scripts & Bestanden**

### **Kern Scripts:**

| Script | Functie | Command |
|--------|---------|---------|
| `generate-weekly-report.js` | Genereert markdown rapport | `npm run report:weekly` |
| `generate-social-media.js` | Genereert social media posts | `npm run report:social` |
| `weekly-report-workflow.sh` | Complete workflow (alles tegelijk) | `npm run report:all` |

### **Output Structuur:**

```
docs/research/weekly/
├── Cross-DEX-Report-2025-W45.md          # Markdown rapport
├── Cross-DEX-Report-2025-W45.html        # HTML (print-ready)
├── Cross-DEX-Report-2025-W45.pdf         # PDF (handmatig)
└── W45-social/                           # Social media content
    ├── linkedin.txt
    ├── twitter-thread.txt
    ├── tweet-1.txt
    ├── tweet-2.txt
    ├── tweet-3.txt
    ├── tweet-4.txt
    ├── tweet-5.txt
    ├── tweet-6.txt
    ├── tweet-7.txt
    ├── instagram.txt
    └── reddit.txt
```

---

## 🚀 **Gebruik**

### **Methode 1: Complete Workflow (Aanbevolen)**

```bash
npm run report:all
```

Dit doet **alles**:
1. ✅ Haalt data uit database
2. ✅ Genereert markdown rapport
3. ✅ Maakt HTML versie
4. ✅ Genereert social media content
5. ✅ Opent HTML in browser voor PDF export

### **Methode 2: Stap voor Stap**

```bash
# Stap 1: Genereer rapport
npm run report:weekly

# Stap 2: Genereer social media
npm run report:social

# Stap 3: Open HTML en maak PDF
open docs/research/weekly/Cross-DEX-Report-2025-W45.html
# Druk Cmd+P, save as PDF
```

### **Methode 3: Alleen Rapport**

```bash
npm run report:weekly
```

---

## ⏰ **Automatische Planning (Cron)**

### **Railway Cron Setup:**

Railway ondersteunt cron jobs voor geautomatiseerde taken.

**Stappen:**

1. **Ga naar Railway Dashboard** → Je project → "Cron Jobs"

2. **Klik "New Cron Job"**

3. **Configureer:**
   - **Name:** `Weekly Report Generator`
   - **Schedule (Cron):** `0 10 * * 1`
   - **Command:** `npm run report:all`
   - **Service:** Link naar je main LiquiLab service

4. **Environment Variables:**
   Zorg dat deze variabelen beschikbaar zijn:
   - `DATABASE_URL` (van Postgres service)
   - Alle andere `.env` vars

**Cron Schedule:**
```
0 10 * * 1
│ │  │ │ │
│ │  │ │ └─── Dag van week (1 = Maandag)
│ │  │ └───── Maand (1-12)
│ │  └─────── Dag van maand (1-31)
│ └────────── Uur (10 = 10:00 AM)
└──────────── Minuut (0 = :00)
```

**Betekenis:** Elke maandag om 10:00 AM CET

### **Lokale Cron Setup (macOS/Linux):**

Als je het lokaal wilt draaien:

```bash
# Open crontab editor
crontab -e

# Voeg deze regel toe:
0 10 * * 1 cd /Users/koen/Desktop/Liquilab && /usr/local/bin/npm run report:all >> /tmp/liquilab-weekly-report.log 2>&1

# Sla op en sluit
```

**Test je cron:**
```bash
# Handmatig testen
cd /Users/koen/Desktop/Liquilab
npm run report:all

# Check cron logs
tail -f /tmp/liquilab-weekly-report.log
```

---

## 📊 **Rapport Data Bronnen**

Het rapport haalt **real-time data** uit de database:

### **Database Queries:**

1. **Total Positions & Wallets**
   ```sql
   SELECT COUNT(DISTINCT "tokenId"), COUNT(DISTINCT "from") + COUNT(DISTINCT "to")
   FROM "PositionTransfer"
   ```

2. **DEX Breakdown**
   ```sql
   SELECT 
     CASE 
       WHEN "nfpmAddress" = '0xd9770b1c7a6ccd33c75b5bcb1c0078f46be46657' THEN 'Enosys'
       WHEN "nfpmAddress" = '0xee5ff5bc5f852764b5584d92a4d592a53dc527da' THEN 'SparkDEX'
     END as dex,
     COUNT(DISTINCT "tokenId") as positions
   FROM "PositionTransfer"
   GROUP BY "nfpmAddress"
   ```

3. **Cross-DEX Users**
   ```sql
   WITH wallet_dex_activity AS (...)
   SELECT COUNT(*) FILTER (WHERE dex_count = 2)
   ```

4. **Top 10 Wallets**
   ```sql
   SELECT wallet, enosys_pos, sparkdex_pos, total_pos
   ORDER BY total_pos DESC LIMIT 10
   ```

5. **TVL (DefiLlama API)**
   ```bash
   GET https://api.llama.fi/tvl/enosys
   GET https://api.llama.fi/tvl/sparkdex
   ```

---

## 📱 **Social Media Workflow**

### **LinkedIn (Long-form)**

**Bestand:** `docs/research/weekly/W45-social/linkedin.txt`

**Format:**
- 🔥 Key insights (bullets)
- 💡 Why it matters
- 📈 Market breakdown
- 📥 Call-to-action

**Beste tijd om te posten:** Maandag-Vrijdag 10:00-11:00 AM CET

### **Twitter/X Thread (7 tweets)**

**Bestanden:** 
- `twitter-thread.txt` (alle tweets in 1 bestand)
- `tweet-1.txt` t/m `tweet-7.txt` (individueel)

**Thread structuur:**
1. Hook met key stats
2. Main finding (cross-DEX users)
3. Market breakdown
4. Top 10 wallets
5. Why cross-DEX wins
6. CTA (download report)
7. Subscribe prompt

**Beste tijd:** Maandag-Vrijdag 13:00-15:00 CET

### **Instagram**

**Bestand:** `instagram.txt`

**Format:**
- Short caption met emojis
- Hashtags
- Call-to-action in comments

**Beste tijd:** Elke dag 18:00-21:00 CET

**Tip:** Maak een visual card met Canva:
- Template: 1080x1080px
- Key stats prominent
- LiquiLab branding (aqua colors)

### **Reddit**

**Bestand:** `reddit.txt`

**Subreddits:**
- r/FlareNetwork
- r/DeFi
- r/CryptoCurrency (als relevant)

**Format:**
- Lange, gedetailleerde post
- Objectieve tone
- Data-driven
- Disclaimer onderaan

**Beste tijd:** Maandag-Vrijdag 15:00-17:00 CET

---

## 🎨 **PDF Export**

### **Stappen:**

1. **Open HTML bestand:**
   ```bash
   open docs/research/weekly/Cross-DEX-Report-2025-W45.html
   ```

2. **Print to PDF:**
   - Druk `Cmd + P` (Mac) of `Ctrl + P` (Windows)
   - Selecteer "Save as PDF"
   - **✅ Enable "Background graphics"**
   - Paper: A4
   - Margins: Default
   - Scale: 100%

3. **Save:**
   - Naam: `Cross-DEX-Report-2025-W45.pdf`
   - Locatie: `docs/research/weekly/`

### **PDF Features:**

- ✅ Professional LiquiLab branding
- ✅ Table of Contents
- ✅ ~20-30 pagina's A4
- ✅ Styled tables
- ✅ Print-optimized layout
- ✅ Footer op elke pagina

---

## 📤 **Distributie Checklist**

Na elke wekelijkse rapportage:

### **Week van [Datum]**

- [ ] **1. Rapport Gegenereerd**
  - [ ] Markdown bestand
  - [ ] HTML bestand
  - [ ] PDF bestand

- [ ] **2. Social Media Gepost**
  - [ ] LinkedIn (long-form post)
  - [ ] Twitter thread (7 tweets)
  - [ ] Instagram (visual + caption)
  - [ ] Reddit (r/FlareNetwork)

- [ ] **3. Website Upload**
  - [ ] Upload PDF naar `liquilab.io/research/weekly/`
  - [ ] Update "Latest Report" link op homepage

- [ ] **4. Email Nieuwsbrief** (optioneel)
  - [ ] Verstuur naar subscriber list
  - [ ] Include download link

- [ ] **5. Community**
  - [ ] Post in Discord
  - [ ] Post in Telegram
  - [ ] Tag partners/influencers

- [ ] **6. Analytics**
  - [ ] Track downloads (Google Analytics)
  - [ ] Monitor social engagement
  - [ ] Note feedback voor volgende week

---

## 📈 **Week-over-Week Trends**

Vanaf **Week 2** worden automatisch trends getoond:

```markdown
| Metric | This Week | Last Week | Change |
|--------|-----------|-----------|--------|
| Total TVL | $60.2M | $58.9M | +2.2% ↗️ |
| Positions | 76,234 | 74,857 | +1.8% ↗️ |
| Cross-DEX Users | 785 | 761 | +3.2% ↗️ |
```

**Data opslag:**
- Elk rapport slaat een snapshot op
- Script vergelijkt met vorige week
- Automatische berekening van %

---

## 🛠️ **Troubleshooting**

### **Probleem: Script faalt**

```bash
# Check database connectie
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"PositionTransfer\";"

# Run met verbose logging
node scripts/generate-weekly-report.js 2>&1 | tee /tmp/report-debug.log
```

### **Probleem: TVL data niet beschikbaar**

Script gebruikt **fallback waardes** als DefiLlama niet bereikbaar is:
```javascript
// Cached values gebruikt als fallback
enosysTVL: 6678235,
sparkdexTVL: 52247677,
```

### **Probleem: Geen data in database**

```bash
# Verify data
psql "$DATABASE_URL" -c "
SELECT COUNT(*) as total_transfers,
       COUNT(DISTINCT \"tokenId\") as unique_positions
FROM \"PositionTransfer\";
"

# Re-run indexer als nodig
npm run indexer:follow:railway
```

### **Probleem: Cron job draait niet**

**Railway:**
- Check Cron Job logs in Dashboard
- Verify environment variables
- Test command manually in service

**Lokaal:**
```bash
# Check cron is actief
crontab -l

# Check cron logs
tail -f /tmp/liquilab-weekly-report.log

# Test manually
cd /Users/koen/Desktop/Liquilab
npm run report:all
```

---

## 📊 **Metrics & KPIs**

Track deze metrics voor elk rapport:

| Metric | Target | Actual |
|--------|--------|--------|
| **Report Views** | 500+ | - |
| **PDF Downloads** | 100+ | - |
| **LinkedIn Engagement** | 50+ likes | - |
| **Twitter Impressions** | 2,000+ | - |
| **Reddit Upvotes** | 20+ | - |
| **Website Traffic** | +10% | - |

---

## 🎯 **Roadmap**

### **Q1 2026:**
- [ ] Automated PDF generation (headless Chrome)
- [ ] Email newsletter automation
- [ ] Interactive web version
- [ ] API endpoints voor data access

### **Q2 2026:**
- [ ] Multi-language support (NL, EN)
- [ ] Video summary generation
- [ ] Infographic templates
- [ ] Partner co-branding

---

## 📞 **Support**

**Vragen over weekly reports?**
- Discord: #analytics-reports
- Email: support@liquilab.io
- Docs: https://docs.liquilab.io/reports

---

**Laatste Update:** 2025-11-09  
**Versie:** 1.0.0  
**Eigenaar:** LiquiLab Analytics Team

