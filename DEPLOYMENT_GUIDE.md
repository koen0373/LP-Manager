# 🚀 Liqui Indexer Deployment Guide

## ✅ Prerequisites

- Vercel app is deployed ✓
- PostgreSQL database is configured ✓
- Indexer code is ready ✓

## 📦 What to Deploy

The **blockchain indexer** is a separate long-running Node.js worker that:
- Fetches position events from Flare blockchain
- Stores them in PostgreSQL
- Enables historical data for Pool Detail & Portfolio Performance pages

---

## 🎯 **Option 1: Railway.app** (Recommended)

Railway is perfect for long-running Node workers with PostgreSQL.

### Step 1: Sign up & Install CLI

```bash
# Visit https://railway.app and sign up with GitHub

# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Or with Homebrew
brew install railway
```

### Step 2: Login & Create Project

```bash
railway login
railway init
```

### Step 3: Link Your Vercel Postgres Database

**Option A: Use Vercel Postgres (Easiest)**

1. Go to your Vercel project → Storage → Postgres
2. Copy the `POSTGRES_URL` (not PRISMA_URL)
3. In Railway dashboard, add environment variable:
   ```
   DATABASE_URL=<your-vercel-postgres-url>
   ```

**Option B: Create New Railway Postgres**

```bash
# In Railway dashboard
railway add --database postgres

# This automatically sets DATABASE_URL
```

### Step 4: Set Environment Variables

In Railway dashboard, add these variables:

```bash
DATABASE_URL=postgresql://...          # From Vercel or Railway
FLARE_RPC_URL=https://flare.flr.finance/ext/bc/C/rpc
NPM_ADDRESS=0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de
START_BLOCK=0                          # Optional: backfill from genesis
NODE_ENV=production
```

### Step 5: Deploy

```bash
# Deploy the indexer
railway up

# Check logs
railway logs
```

### Step 6: Start Indexer Service

In Railway dashboard:
1. Go to Settings → Service
2. Set **Start Command**: `npm run indexer:follow`
3. Or for backfill first: `npm run indexer:backfill && npm run indexer:follow`
4. Restart the service

✅ **Done!** Your indexer is now running 24/7 on Railway.

---

## 🎯 **Option 2: Fly.io** (Developer-friendly)

Fly.io offers great developer experience with good free tier.

### Step 1: Install Fly CLI

```bash
# macOS
curl -L https://fly.io/install.sh | sh

# Or with Homebrew
brew install flyctl
```

### Step 2: Login & Launch

```bash
flyctl auth login
flyctl launch
```

Follow prompts:
- App name: `liqui-indexer`
- Region: Choose closest to your database
- Postgres: **No** (use Vercel Postgres)

### Step 3: Set Environment Variables

```bash
flyctl secrets set \
  DATABASE_URL=postgresql://... \
  FLARE_RPC_URL=https://flare.flr.finance/ext/bc/C/rpc \
  NPM_ADDRESS=0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de \
  START_BLOCK=0
```

### Step 4: Configure fly.toml

Edit `fly.toml`:

```toml
app = "liqui-indexer"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

### Step 5: Deploy

```bash
flyctl deploy

# Check logs
flyctl logs
```

✅ **Done!** Indexer is running on Fly.io.

---

## 🎯 **Option 3: Docker (Self-hosted)**

For running on your own server (VPS, AWS EC2, etc.).

### Step 1: Build Image

```bash
docker build -t liqui-indexer .
```

### Step 2: Run Container

```bash
docker run -d \
  --name liqui-indexer \
  --restart unless-stopped \
  -e DATABASE_URL=postgresql://... \
  -e FLARE_RPC_URL=https://flare.flr.finance/ext/bc/C/rpc \
  -e NPM_ADDRESS=0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de \
  -e START_BLOCK=0 \
  -e NODE_ENV=production \
  liqui-indexer
```

### Step 3: Check Logs

```bash
docker logs -f liqui-indexer
```

### Step 4: Stop/Restart

```bash
docker stop liqui-indexer
docker start liqui-indexer
docker restart liqui-indexer
```

---

## 📊 **Monitoring & Maintenance**

### Check Indexer Status

```bash
# Via Railway
railway logs

# Via Fly.io
flyctl logs

# Via Docker
docker logs -f liqui-indexer
```

### Run Sanity Check (Local)

```bash
# Connect to Vercel Postgres
export DATABASE_URL=postgresql://...

# Check indexed data
npm run indexer:sanity

# Check specific position
npm run indexer:sanity 22003
```

### Manual Backfill (if needed)

```bash
# Backfill specific positions
npm run indexer:backfill 22003 22326

# Backfill all (global)
npm run indexer:backfill

# Dry run (don't write to DB)
npm run indexer:backfill -- --dry
```

---

## 🐛 **Troubleshooting**

### Indexer not starting

**Check logs for errors:**
```bash
railway logs          # Railway
flyctl logs           # Fly.io
docker logs indexer   # Docker
```

**Common issues:**
- `DATABASE_URL` not set → Add environment variable
- `FLARE_RPC_URL` unreachable → Try alternative RPC: `https://flare-api.flare.network/ext/bc/C/rpc`
- Database connection timeout → Check firewall/network settings

### Indexer running but no data

**Check database connection:**
```bash
# Test connection
npx prisma db pull
```

**Verify tables exist:**
```bash
npx prisma studio
# Check if PositionEvent, PositionTransfer, SyncCheckpoint tables exist
```

**Run backfill manually:**
```bash
npm run indexer:backfill 22003 -- --verbose
```

### High memory usage

**Reduce concurrency in `indexer.config.ts`:**
```typescript
maxConcurrency: 2,  // Down from 4
blockRange: 2500,   // Down from 5000
```

### RPC rate limiting

**Reduce request rate:**
```typescript
requestDelayMs: 100,  // Up from 50
maxConcurrency: 1,    // Down to 1
```

---

## 🎨 **What Happens After Deployment**

Once the indexer is running:

1. **First Run**: Backfills historical events from genesis
   - Takes ~10-30 minutes depending on START_BLOCK
   - Progress logged to console

2. **Follow Mode**: Continuously syncs new blocks
   - Checks every 10 seconds
   - Stores new events in real-time

3. **Data Available**: Pool Detail & Portfolio pages show historical data
   - Pool Earnings with creation date and initial TVL
   - Pool Activity with all transactions
   - Portfolio Performance with realized fees

4. **Checkpoints**: Indexer saves progress
   - Can restart from last checkpoint
   - No duplicate data

---

## 📈 **Expected Performance**

- **Backfill Speed**: 3,000-10,000 blocks/sec
- **Follow Mode**: ~1-2 sec latency behind chain
- **Memory Usage**: 100-300 MB
- **CPU Usage**: 10-30% (during active indexing)
- **Database Size**: ~10-50 MB per 10k events

---

## ✅ **Verification Checklist**

After deployment, verify:

- [ ] Indexer service is running (check logs)
- [ ] Database tables created (PositionEvent, PositionTransfer, SyncCheckpoint)
- [ ] Checkpoint is advancing (check `SyncCheckpoint.lastBlock`)
- [ ] Events are being stored (check `PositionEvent` count)
- [ ] Pool Detail page shows historical data
- [ ] Portfolio Performance page shows data

---

## 🎯 **Next Steps After Indexer is Running**

1. **Test the site**: Visit pool detail pages and portfolio performance
2. **Monitor logs**: Check for errors or RPC throttling
3. **Optimize**: Tune `indexer.config.ts` based on performance
4. **Scale**: Add more workers if needed (Railway/Fly support horizontal scaling)

---

## 💡 **Tips**

- **Use Vercel Postgres for simplicity** (same DB for Next.js app + indexer)
- **Railway is easiest** for quick deployment with great UX
- **Fly.io is best** for developer control and customization
- **Docker is best** for self-hosting or multi-cloud
- **Run backfill first** before enabling follow mode
- **Monitor DATABASE_URL** carefully (don't expose publicly)
- **Set START_BLOCK** to recent block (~1 month ago) for faster initial sync

---

## 📚 **Additional Resources**

- [Railway Docs](https://docs.railway.app/)
- [Fly.io Docs](https://fly.io/docs/)
- [Docker Docs](https://docs.docker.com/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Indexer Architecture](./docs/INDEXER.md)

---

**Need help?** Check logs first, then consult `docs/INDEXER.md` for detailed troubleshooting.

