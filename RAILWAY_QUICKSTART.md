# 🚂 Railway Deployment - Quick Start

Je bent ingelogd op Railway! Hier zijn de exacte stappen om de indexer te deployen.

---

## 🚀 **Methode 1: Via Railway Dashboard** (Aanbevolen)

### Stap 1: Deploy from GitHub

1. Open: https://railway.app/new
2. Klik **"Deploy from GitHub repo"**
3. Selecteer: `koen0373/LP-Manager`
4. Railway detecteert automatisch de `Dockerfile`
5. Klik **"Deploy Now"**

### Stap 2: Environment Variables

1. Ga naar je project in Railway dashboard
2. Klik **"Variables"** tab
3. Add deze variabelen (klik **"+ New Variable"** voor elke):

```bash
DATABASE_URL = [PASTE JE VERCEL POSTGRES_URL HIER]
FLARE_RPC_URL = https://flare.flr.finance/ext/bc/C/rpc
NPM_ADDRESS = 0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de
START_BLOCK = 0
NODE_ENV = production
```

**Waar vind je DATABASE_URL?**
- Ga naar: https://vercel.com/koen0373/enosys-lp-manager-v2/settings/environment-variables
- Zoek: `POSTGRES_URL` (NIET `POSTGRES_PRISMA_URL`)
- Kopieer de hele waarde (begint met `postgres://...`)

### Stap 3: Set Start Command

1. In Railway dashboard → **Settings** tab
2. Scroll naar **Deploy** sectie
3. Find **Start Command** en vul in:
   ```bash
   npm run indexer:follow
   ```
   
   Of voor backfill eerst:
   ```bash
   npm run indexer:backfill && npm run indexer:follow
   ```

4. Klik **Redeploy** (top right)

### Stap 4: Check Logs

Ga naar **Deployments** tab en klik op de actieve deployment om logs te zien.

Je zou moeten zien:
```
[INDEXER] Starting indexer core...
[RPC] Scanning blocks...
[DB] Writing events...
```

---

## 🚀 **Methode 2: Via CLI** (Voor in je eigen terminal)

Open een **nieuwe terminal** (NIET in Cursor) en run:

```bash
# 1. Navigate to project
cd /Users/koen/Desktop/enosys-lp-manager-v2

# 2. Initialize Railway project
railway init
# - Workspace: koen0373's Projects
# - Create new project: Yes
# - Name: liqui-indexer

# 3. Set environment variables (automated script)
./railway-setup.sh
# Paste je Vercel DATABASE_URL wanneer gevraagd

# 4. Deploy
railway up

# 5. Open dashboard to set Start Command
railway open
# → Settings → Start Command: npm run indexer:follow

# 6. View logs
railway logs -f
```

---

## 📊 **Monitoring**

### Check if it's working

```bash
# View live logs
railway logs -f

# Check service status
railway status

# Open dashboard
railway open
```

### Expected Log Output

```
🚀 Starting indexer in FOLLOW mode...
[INDEXER] Starting from checkpoint block 45123456
[RPC] ✓ 45123456→45128456 (245 logs / 1234ms)
[DB] Wrote 245 events, 12 transfers, 0 duplicates
[CHECKPOINT] Saved: source=NPM key=global block=45128456
[INDEXER] ⏸  No new blocks yet (latest: 45128456)
```

### Check Database

In je terminal (lokaal):

```bash
# Set DATABASE_URL (same as Railway)
export DATABASE_URL="postgres://..."

# Run sanity check
npm run indexer:sanity

# Check specific position
npm run indexer:sanity 22003
```

Output should show:
```
📊 Sanity Check: Position 22003
✓ Events: 47 (Mint: 1, Increase: 3, Decrease: 1, Collect: 12)
✓ Transfers: 1
✓ Block range: 44891234 → 45128456
```

---

## 🐛 **Troubleshooting**

### "Build failed"

**Check logs in Railway:**
- Go to Deployments → Click failed deployment
- Look for error message

**Common fixes:**
1. Make sure `Dockerfile` exists in repo root
2. Check if all dependencies are in `package.json`
3. Ensure `prisma/schema.prisma` is committed

### "Database connection failed"

**Check DATABASE_URL:**
1. Make sure you used `POSTGRES_URL` from Vercel (NOT `POSTGRES_PRISMA_URL`)
2. URL should start with `postgres://` (NOT `postgresql://`)
3. Check for typos or missing characters

**Test locally:**
```bash
export DATABASE_URL="your-railway-database-url"
npx prisma db pull
```

### "No logs / Not indexing"

**Check Start Command:**
1. Railway dashboard → Settings → Deploy
2. Make sure **Start Command** is set to: `npm run indexer:follow`
3. **Redeploy** after changing

**Check environment variables:**
```bash
railway variables
```

Should show all 5 variables (DATABASE_URL, FLARE_RPC_URL, NPM_ADDRESS, START_BLOCK, NODE_ENV)

### "RPC errors / Rate limiting"

**Edit `indexer.config.ts`:**

Reduce concurrency:
```typescript
maxConcurrency: 2,  // Down from 4
blockRange: 2500,   // Down from 5000
```

Then redeploy:
```bash
git add indexer.config.ts
git commit -m "reduce RPC rate"
git push
railway up
```

---

## ✅ **Verification Checklist**

After deployment, verify:

- [ ] Railway service is **Active** (green dot in dashboard)
- [ ] Logs show indexing progress
- [ ] No error messages in logs
- [ ] Database tables exist (`npx prisma studio` to check)
- [ ] Checkpoint is advancing (check logs for "[CHECKPOINT] Saved")
- [ ] Pool Detail page on Vercel shows historical data
- [ ] Portfolio Performance page shows data

---

## 🎯 **Next Steps**

Once indexer is running successfully:

1. **Test the site:**
   - Visit: https://enosys-lp-manager-v2.vercel.app
   - Go to any pool detail page (e.g., `/pool/22003`)
   - Check if "Pool Activity" shows historical transactions

2. **Monitor performance:**
   ```bash
   railway logs -f
   ```
   - Watch for consistent progress
   - No repeated errors
   - Checkpoint advancing every 10-30 seconds

3. **Optimize if needed:**
   - Edit `indexer.config.ts` to tune performance
   - Adjust `blockRange`, `maxConcurrency`, `requestDelayMs`

---

## 📈 **Expected Performance**

- **First Backfill**: 10-30 minutes (depending on START_BLOCK)
- **Follow Mode**: 1-2 sec latency behind chain
- **Memory**: 150-250 MB
- **CPU**: 10-20% average

---

## 💰 **Railway Costs**

- **Free Tier**: $5 worth of resources/month
- **Indexer Usage**: ~$3-5/month (well within free tier)
- **If exceeded**: Upgrade to Hobby ($5/month unlimited)

Check usage: https://railway.app/account/usage

---

## 🆘 **Need Help?**

1. **Check logs first:** `railway logs -f`
2. **Check documentation:** `DEPLOYMENT_GUIDE.md`, `docs/INDEXER.md`
3. **Test locally:** `docker build -t test . && docker run test`
4. **Railway docs:** https://docs.railway.app/

---

**Ready to deploy?** Start with Railway Dashboard method (easiest) or CLI (more control).

Good luck! 🚀

