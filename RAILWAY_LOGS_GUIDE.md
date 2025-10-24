# 🚂 Railway Deployment Logs Guide

## Hoe Railway logs te delen met Cursor AI

### Automatisch (na elke push)
1. Push naar `main` branch
2. Wacht 2-3 minuten
3. Ga naar **GitHub Actions** tab
4. Open de run "Auto-Fetch Railway Logs After Deploy"
5. Scroll naar beneden naar **Artifacts**
6. Download `railway-deployment-logs-[commit-sha].zip`
7. Pak uit en open `final-deployment-logs.txt`
8. **Kopieer de logs en plak in Cursor chat**

### Handmatig (on-demand)
1. Ga naar **GitHub Actions** tab
2. Klik op "Fetch Railway Deployment Logs" (links)
3. Klik **Run workflow** (rechts)
4. Wacht tot workflow compleet is
5. Download artifact en deel logs met Cursor

---

## Railway Secrets Setup

Voor deze workflows heb je nodig:

### 1. RAILWAY_API_TOKEN
```bash
# Get from Railway Dashboard
# Settings → Tokens → Create Token
```

### 2. RAILWAY_PROJECT_ID
```bash
# Get from Railway project URL
# https://railway.app/project/[PROJECT_ID]
```

### 3. Add to GitHub Secrets
1. GitHub repo → Settings → Secrets and variables → Actions
2. Add `RAILWAY_API_TOKEN`
3. Add `RAILWAY_PROJECT_ID`

---

## Quick Links

- Railway Dashboard: https://railway.app/dashboard
- GitHub Actions: https://github.com/[your-repo]/actions
- Latest deployment: Check commit comments

---

## Workflow Files

- **Auto-fetch after push**: `.github/workflows/auto-fetch-railway-logs.yml`
- **Manual fetch**: `.github/workflows/fetch-railway-logs.yml`
- **Post-deploy backfill**: `.github/workflows/post-deploy-backfill.yml`

