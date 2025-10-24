# 🏗️ Liqui LP Manager - Project State Documentation

> **Laatst geüpdatet**: 24 oktober 2025, 22:45  
> **Versie**: v2.8.0 - Live Chart Updates  
> **Status**: ✅ Production Ready

---

## 📐 **Architectuur Overview**

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  pages/index.tsx          → Homepage (LP Positions Table)        │
│  pages/pool/[tokenId].tsx → Pool Detail Page                     │
│  pages/summary.tsx        → Portfolio Performance                │
│  pages/_app.tsx           → Global layout + WalletConnect        │
└─────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                        API ROUTES (Next.js)                      │
├─────────────────────────────────────────────────────────────────┤
│  /api/positions           → Fetch LP positions for wallet        │
│  /api/pool/[tokenId]      → Pool detail + price history          │
│  /api/wallet/summary      → Wallet aggregated data               │
└─────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER (Services)                       │
├─────────────────────────────────────────────────────────────────┤
│  pmFallback.ts           → Viem on-chain position reader (PRIMARY)│
│  flarescanService.ts     → FlareScan API fallback                │
│  rflrRewards.ts          → RFLR rewards calculation              │
│  tokenPrices.ts          → Token price resolution (CoinGecko)    │
│  collectEvents.ts        → Fee claim event tracking              │
│  positionLedger.ts       → Historical event ledger sync          │
└─────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                      BLOCKCHAIN LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Viem (RPC)              → Live on-chain reads (slot0, positions)│
│  Prisma DB (SQLite)      → Cached events (PositionEvent, etc)    │
│  FlareScan API           → Contract metadata, transactions       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔒 **KRITIEKE BESTANDEN - NIET AANPASSEN ZONDER EXPLICIETE TOESTEMMING**

Deze bestanden bevatten werkende core functionaliteit. **Alleen wijzigen als expliciet gevraagd!**

### ✅ **Positions API (Homepage werkt hiervan!)**
- `pages/api/positions.ts` - Haalt LP positions op via Viem + FlareScan fallback
- `src/services/pmFallback.ts` - Viem on-chain position reader (PRIMARY method)
- `src/services/flarescanService.ts` - FlareScan API calls (FALLBACK)

### ✅ **Data Processing**
- `src/utils/poolHelpers.ts` - Price calculations, tick conversions, TVL
- `src/services/tokenPrices.ts` - Token price resolution (CoinGecko + hardcoded)
- `src/services/rflrRewards.ts` - RFLR reward calculations

### ✅ **UI Components**
- `src/components/PositionsTable.tsx` - Homepage table (Active/Inactive tabs)
- `src/components/Header.tsx` - Navigation + WalletConnect
- `src/components/WalletConnect.tsx` - Wallet connection logic

### ✅ **Pool Detail**
- `src/features/poolDetail/PoolPairDetail.tsx` - Pool detail layout
- `src/features/poolDetail/EChartsRangeChart.tsx` - Live price chart
- `pages/api/pool/[tokenId].ts` - Pool detail API endpoint

---

## 🔄 **DATA FLOWS (Werkende Implementaties)**

### **1. Homepage - LP Positions**
```
User connects wallet (MetaMask)
    ↓
WalletConnect context updates
    ↓
pages/index.tsx fetches: GET /api/positions?address=0x...
    ↓
/api/positions.ts:
    ├─ PRIMARY: getLpPositionsOnChain() via Viem
    │   ├─ Reads NonfungiblePositionManager contract
    │   ├─ Fetches token metadata, liquidity, ticks
    │   ├─ Calculates TVL, prices, range status
    │   └─ Adds RFLR rewards via rflrRewards.ts
    │
    └─ FALLBACK: getWalletPositionsViaFlareScan() via FlareScan API
        └─ Parses NFT transfers + on-chain calls

    ↓
PositionsTable.tsx renders positions
    ├─ Active tab: inRange positions, sorted by fees (high→low)
    ├─ Inactive tab: !inRange positions with rewards >0, sorted by rewards
    └─ Shows: Specifics, Liquidity, Fees, Rewards (RFLR), Status
```

### **2. Pool Detail Page - Live Chart**
```
User clicks on a position row
    ↓
Navigate to: /pool/[tokenId]
    ↓
pages/pool/[tokenId].tsx:
    ├─ getServerSideProps fetches: GET /api/pool/[tokenId]
    │   ├─ Fetches position data via pmFallback.ts
    │   ├─ Builds price history from Prisma DB (buildPriceHistory)
    │   ├─ Fetches contract creation date from FlareScan
    │   ├─ Syncs ledger events (PositionEvent, PositionTransfer)
    │   └─ Calculates TVL, rewards, fees, APY, IL
    │
    └─ Returns PoolDetailVM with live data

    ↓
PoolPairDetail.tsx renders:
    ├─ Pool info (icons, pair, ID, contract link)
    ├─ Range status (In/Out range indicator)
    ├─ Liquidity block (token amounts, TVL, pool share %)
    ├─ Rewards block (unclaimed fees, RFLR, delegation, Flare drops)
    ├─ EChartsRangeChart (price + range visualization)
    │   ├─ Historical data from Prisma DB
    │   ├─ Live price updates via viem.readContract(slot0) every 30s
    │   ├─ Time range selector (24h/7D/1M/1Y)
    │   ├─ Dynamic Y-axis scaling
    │   ├─ Outlier filtering
    │   └─ Min/Max/Current price lines
    ├─ Pool Earnings (creation date, TVL, fees, rewards, APY)
    └─ Pool Activity (Mint, Increase, Decrease, Collect, Burn events)
```

### **3. Portfolio Performance**
```
User clicks "Portfolio Performance" in header
    ↓
pages/summary.tsx fetches: GET /api/wallet/summary?wallet=0x...
    ↓
/api/wallet/summary.ts:
    ├─ Aggregates all positions via getWalletPositions()
    ├─ Reads PositionEvent from Prisma for realized fees
    ├─ Calculates totals: TVL, fees, rewards, ROI
    └─ Returns capital timeline + recent activity

    ↓
Renders:
    ├─ Top cards: Total TVL, Realized Fees, Rewards, ROI
    ├─ Active Pools list (with fees + RFLR)
    ├─ Inactive Pools list (only if rewards > 0)
    └─ Recent activity timeline
```

---

## 🗄️ **DATABASE & CACHING**

### **Prisma Schema** (`prisma/schema.prisma`)
```prisma
model PositionEvent {
  id              String   @id @default(cuid())
  tokenId         Int
  pool            String
  eventName       String   // MINT, INCREASE, DECREASE, COLLECT, BURN
  timestamp       Int
  blockNumber     Int
  txHash          String
  logIndex        Int
  amount0         String?
  amount1         String?
  liquidityDelta  String?
  tick            Int?
  sqrtPriceX96    String?
  price1Per0      Float?
  usdValue        Float?
  metadata        String?  // JSON
  createdAt       DateTime @default(now())
  
  @@unique([txHash, logIndex])
  @@index([tokenId])
  @@index([pool])
}

model PositionTransfer {
  id          String   @id @default(cuid())
  tokenId     Int
  from        String
  to          String
  timestamp   Int
  blockNumber Int
  txHash      String
  createdAt   DateTime @default(now())
  
  @@unique([txHash, tokenId])
  @@index([tokenId])
}

model PoolEvent {
  id           String   @id @default(cuid())
  pool         String
  eventName    String   // Swap, Flash, etc
  timestamp    Int
  blockNumber  Int
  txHash       String
  logIndex     Int
  tick         Int?
  sqrtPriceX96 String?
  amount0      String?
  amount1      String?
  liquidity    String?
  createdAt    DateTime @default(now())
  
  @@unique([txHash, logIndex])
  @@index([pool])
}
```

### **Backfill Scripts**
```bash
# Sync position events to database
npm run backfill <tokenId> -- --verbose

# Example:
npm run backfill 22003 -- --verbose
```

### **Cache Layers**
1. **API Route Cache** (`pages/api/positions.ts`)
   - TTL: 60 seconds
   - Key: `wallet-address`
   - Cleared on refresh=1

2. **Memoized Cache** (`src/lib/util/memo.ts`)
   - Used for: Token prices, RFLR rewards, position data
   - TTL: Variable (30s - 5min)
   - Keys: `token-price-${address}`, `rflr-rewards-${tokenId}`

3. **Prisma Query Cache**
   - Reads from SQLite DB
   - Invalidated on backfill sync

---

## 🌐 **ENVIRONMENT VARIABLES**

### **Local Development** (`.env.local`)
```env
# Required
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your-project-id>

# RPC Endpoints (Flare Network)
NEXT_PUBLIC_FLARE_RPC=https://flare-api.flare.network/ext/C/rpc
NEXT_PUBLIC_COSTON_RPC=https://coston-api.flare.network/ext/C/rpc

# FlareScan API (Etherscan-like)
FLARESCAN_API_URL=https://flare-explorer.flare.network/api
FLARESCAN_API_KEY=<optional>

# Database (Railway Postgres - for local testing with production DB)
DATABASE_URL="postgresql://..."  # Get from Railway dashboard

# Optional
NODE_ENV=development
NEXT_TELEMETRY_DISABLED=1
```

### **Production (Railway)**

Railway provides `DATABASE_URL` automatically when you add Postgres service.

**Web App Service** (only service):
- `DATABASE_URL` → Auto-provided by Railway Postgres
- `NEXT_PUBLIC_FLARE_RPC` → https://flare-api.flare.network/ext/C/rpc
- `NEXT_PUBLIC_COSTON_RPC` → https://coston-api.flare.network/ext/C/rpc
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` → Your WalletConnect project ID
- `FLARESCAN_API_URL` → https://flare-explorer.flare.network/api
- `NODE_ENV` → production
- `CACHE_BUST` → v0.1.4 (bump to force rebuild)

---

## 🧪 **TEST CHECKLIST (Voor Elke Major Change)**

### **Homepage (My Pools)**
- [ ] Wallet connect werkt (MetaMask popup)
- [ ] Active positions worden getoond
- [ ] Inactive positions met rewards worden getoond (rewards > 0)
- [ ] Inactive positions zonder rewards worden verborgen
- [ ] Sorting: Active by fees (high→low), Inactive by rewards (high→low)
- [ ] Pool icons laden correct (WFLR, eUSDT, FXRP, etc)
- [ ] Current price wordt getoond in Range kolom
- [ ] RFLR rewards worden getoond ($ + RFLR amount)
- [ ] Pool share % wordt getoond in Liquidity kolom
- [ ] Range indicator (horizontal line + vertical bar) werkt
- [ ] Klikken op row navigeert naar /pool/[tokenId]

### **Pool Detail Page**
- [ ] Page laadt binnen 5 seconden
- [ ] Pool info block: icons, pair, ID, contract link
- [ ] Range indicator: groen knipperend (in range) / rood statisch (out of range)
- [ ] Liquidity block: token amounts, $ values, pool share %
- [ ] Rewards block: unclaimed fees, RFLR, delegation, Flare drops
- [ ] ECharts laadt zonder errors
- [ ] Time range selector werkt (24h/7D/1M/1Y)
- [ ] Chart toont min/max range lines (groen gestippeld)
- [ ] Chart toont current price line (blauw, "Now")
- [ ] Live price updates na 30 seconden (check console)
- [ ] Pool Earnings block: creation date, TVL, fees, rewards, APY
- [ ] Pool Activity block: events (Mint, Increase, Collect, etc)
- [ ] Activity metrics tonen correct (token amounts, USD values)
- [ ] Refresh button werkt (herlaadt data)

### **Portfolio Performance**
- [ ] Page laadt zonder errors
- [ ] Top cards: TVL, Realized Fees, Rewards, ROI
- [ ] ROI is groen bij positief, rood bij negatief
- [ ] Active pools list toont correct
- [ ] Inactive pools list toont alleen pools met rewards > 0
- [ ] Pool icons + pair names laden correct
- [ ] Fees en RFLR rewards kloppen per pool

### **General**
- [ ] Header navigatie werkt (My Pools, Portfolio Performance)
- [ ] Wallet disconnect werkt
- [ ] Network switcher toont Flare
- [ ] Refresh icon in header werkt
- [ ] Water background animatie laadt
- [ ] Geen console errors (behalve dev warnings)
- [ ] Mobile responsive (≥320px)

---

## 🚨 **BEKENDE ISSUES & WORKAROUNDS**

### **1. Railway Logging Rate Limit**
```
Railway rate limit of 500 logs/sec reached
Messages dropped: 1065
```
**Status**: ⚠️ Actief issue  
**Oorzaak**: Te veel console.log statements in development code (284 occurrences)  
**Impact**: Logs worden gedropt in production, maar app blijft werken  
**TODO**: Wrap alle console.log in `if (process.env.NODE_ENV !== 'production')` checks  
**Workaround**: Gebruik `src/lib/util/devLog.ts` voor nieuwe code:
```typescript
import { devLog } from '@/lib/util/devLog';
devLog.log('Debug info'); // Only logs in development
devLog.error('Error');     // Always logs
```

### **2. FlareScan 403 Error (Contract Creation Date)**
```
[Flarescan] contract creation for 0x686f53...4DbE1 failed with status 403
```
**Status**: ✅ Fixed (graceful fallback)  
**Oorzaak**: FlareScan API rate limiting or requires API key  
**Impact**: Contract creation date not available (non-critical)  
**Fix**: Wrapped in production-silent error handling, app continues normally  
**Fallback**: Uses pool discovery date or current date as placeholder

### **3. Prisma Studio Error**
```
Error: uv_interface_addresses returned Unknown system error 1
```
**Workaround**: Dit is een macOS networking issue, maar Prisma werkt nog steeds. Negeer de error of gebruik `npx prisma studio --browser none &` om in background te draaien.

### **2. Git Push Authentication**
```
fatal: could not read Username for 'https://github.com': Device not configured
```
**Workaround**: Gebruik SSH keys of GitHub CLI: `gh auth login`

### **3. Slow Pool Detail Loading (>10s)**
**Status**: ❌ Nog op te lossen  
**Oorzaak**: Te veel sequentiële RPC calls, geen parallel fetching  
**TODO**: Implementeer Promise.all() voor concurrent data fetching

### **4. Inactive Pools Met 0 Rewards**
**Status**: ✅ Opgelost (v2.7.0)  
**Fix**: Filter: `positions.filter(p => !p.inRange && p.rflrUsd > 0)`

---

## 📦 **DEPENDENCIES (Belangrijkste)**

```json
{
  "next": "15.5.6",
  "react": "18.3.1",
  "viem": "^2.21.54",
  "wagmi": "^2.12.26",
  "@prisma/client": "^6.1.0",
  "echarts": "^5.5.1",
  "echarts-for-react": "^3.0.2",
  "@tanstack/react-query": "^5.62.8",
  "tailwindcss": "^3.4.17",
  "typescript": "5.7.2"
}
```

---

## 🛠️ **DEVELOPMENT COMMANDS**

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run backfill for position events
npm run backfill <tokenId> -- --verbose

# Prisma commands
npx prisma generate           # Generate client
npx prisma migrate dev        # Run migrations
npx prisma studio            # Open DB viewer

# Linting
npm run lint
```

---

## 🚂 **RAILWAY DEPLOYMENT (Production)**

### **Active Services**

We run **ONE Railway service**:

#### **Main Web App (Next.js)**
- **URL**: https://liqui-lp-manager.up.railway.app (or custom domain)
- **Port**: 3000 (set by Railway)
- **Docker**: Yes (`Dockerfile` in repo root)
- **Auto-deploy**: On push to `main` branch
- **Start Command**: `./start.sh` (runs migrations + starts Next.js)

**Environment Variables (Railway Dashboard)**:
```bash
DATABASE_URL=postgresql://...              # Railway Postgres (auto-provided)
NEXT_PUBLIC_FLARE_RPC=https://flare-api.flare.network/ext/C/rpc
NEXT_PUBLIC_COSTON_RPC=https://coston-api.flare.network/ext/C/rpc
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
FLARESCAN_API_URL=https://flare-explorer.flare.network/api
NODE_ENV=production
CACHE_BUST=v0.1.3                          # Increment to force rebuild
```

**Note**: The event indexer worker service was removed. Pool data is now fetched **on-demand** via:
- Live on-chain reads (viem) for current positions
- Prisma database for cached historical events
- Manual backfill via GitHub Actions or API endpoints when needed

**Deployment Process**:
```bash
# 1. Make code changes locally
# 2. Test: npm run dev
# 3. Commit:
git add .
git commit -m "feature: Add X"

# 4. If CSS/UI changes, bump cache bust in Dockerfile:
# Edit Dockerfile line 6: ARG CACHE_BUST=v0.1.4

# 5. Push:
git push origin main

# 6. Railway auto-deploys within 2-3 minutes
# 7. Check: https://liqui-lp-manager.up.railway.app
```

**Troubleshooting**:
- **Changes not visible?** → Bump `CACHE_BUST` in `Dockerfile` (line 6)
- **Build fails?** → Check Railway logs in dashboard
- **500 errors?** → Check application logs in Railway
- **Database errors?** → Verify `DATABASE_URL` in Railway variables

### **Database (Railway Postgres)**

- **Host**: Railway
- **Provider**: Railway Postgres
- **Access**: Via `DATABASE_URL` environment variable (provided by Railway)
- **Schema**: Managed by Prisma (`prisma/schema.prisma`)

**Tables**:
- `PositionEvent` - Position-level events (Mint, Increase, Decrease, Collect, Burn)
- `PositionTransfer` - NFT ownership transfers
- `PoolEvent` - Pool-level events (Swap, Flash, etc)
- `Checkpoint` - Indexer progress tracking

**Setup** (First time):
```bash
# Add Postgres to your Railway project
railway add -s postgresql

# Get DATABASE_URL
railway variables

# Copy DATABASE_URL to .env.local for local development
```

**Migrations**:
```bash
# Create new migration (local)
npx prisma migrate dev --name add_new_table

# Deploy migration (Railway auto-runs on startup via start.sh)
# Or manually:
railway run npx prisma migrate deploy
```

**View Data**:
```bash
# Local (with production DB)
export DATABASE_URL="postgresql://..."
npx prisma studio

# Or use Railway dashboard:
# Project → Postgres → Data tab
```

### **GitHub Actions (CI/CD)**

#### **Workflow: Post-Deploy Backfill** (`.github/workflows/post-deploy-backfill.yml`)

**Trigger**: Manual only (`workflow_dispatch`)

**Purpose**: Sync specific position events after deployment

**Usage**:
1. Go to: https://github.com/koen0373/LP-Manager/actions
2. Select "Post-Deploy Backfill"
3. Click "Run workflow"
4. Wait for completion (2-5 minutes)

**What it does**:
```bash
# Calls production API endpoint:
POST /api/admin/backfill
{
  "tokenIds": [22003, 22326, 20445, 21866],
  "secret": "${{ secrets.ADMIN_SECRET }}",
  "mode": "since"
}
```

**Secrets Required** (GitHub repo settings):
- `PROD_URL` - https://liqui-lp-manager.up.railway.app
- `ADMIN_SECRET` - Secret key for admin endpoints

### **Deployment Checklist**

Before deploying to Railway:

- [ ] Test locally (`npm run dev`)
- [ ] Test build locally (`npm run build`)
- [ ] Run linter (`npm run lint`) - no errors
- [ ] Update `CACHE_BUST` in Dockerfile (if UI changes)
- [ ] Commit all changes
- [ ] Push to `main`
- [ ] Wait for Railway deployment (2-3 min)
- [ ] Check Railway logs for errors
- [ ] Test production URL
- [ ] Verify database migrations applied
- [ ] Run smoke test (connect wallet, view positions)
- [ ] Check pool detail pages load correctly
- [ ] Verify live chart updates work

### **Production Monitoring**

**Railway Dashboard**:
- Web App: https://railway.app/project/<web-app-id>
- Database: Railway Dashboard → Postgres service

**Key Metrics**:
- **Web App**:
  - Memory: 200-400 MB
  - CPU: 5-15% average
  - Response time: <500ms (p95)

**Alerts** (Set up in Railway):
- Memory > 80% → Increase instance size
- CPU > 90% sustained → Optimize queries
- Database connection errors → Check Postgres health

### **Costs (Railway)**

- **Free Tier**: $5 worth of resources/month
- **Current Usage**:
  - Web App: ~$3-5/month
  - Database: Included in Web App service
  - **Total**: ~$3-5/month (within free tier)
- **Plan**: Free Tier (sufficient for current usage)

**Check usage**: https://railway.app/account/usage

### **Rollback Procedure**

If production breaks after deployment:

1. **Quick Rollback** (Railway Dashboard):
   ```
   Deployments → Click previous working deployment → "Redeploy"
   ```

2. **Git Rollback** (if needed):
   ```bash
   # Find last working commit
   git log --oneline
   
   # Revert to that commit
   git revert <commit-hash>
   git push origin main
   ```

3. **Database Rollback** (if migrations failed):
   ```bash
   railway run npx prisma migrate reset
   railway run npx prisma migrate deploy
   ```

### **Production URLs**

- **Main App**: https://liqui-lp-manager.up.railway.app
- **API Health**: https://liqui-lp-manager.up.railway.app/api/health
- **Railway Postgres**: Railway Dashboard → Project → Postgres → Data tab
- **GitHub Actions**: https://github.com/koen0373/LP-Manager/actions
- **Railway Dashboard**: https://railway.app/dashboard

---

## 📝 **CHANGE LOG**

### **v2.8.0** (24 okt 2025) - Live Chart Updates
- ✅ Implemented on-chain live price polling via viem
- ✅ Dynamic Y-axis scaling per time range
- ✅ Outlier filtering (>50% deviation)
- ✅ Smooth chart updates (no remount)
- ✅ Min/Max/Current price lines
- ✅ Time range selector (24h/7D/1M/1Y)

### **v2.7.0** (23 okt 2025) - Pool Detail Page
- ✅ Full pool detail page implementation
- ✅ Price history chart (ECharts)
- ✅ Pool earnings block
- ✅ Pool activity ledger (Prisma events)
- ✅ Range indicator (blinking dot)

### **v2.6.0** (22 okt 2025) - Portfolio Performance
- ✅ Wallet summary page
- ✅ Aggregated TVL, fees, rewards, ROI
- ✅ Active/Inactive pools list
- ✅ Recent activity timeline

### **v2.5.0** (21 okt 2025) - Homepage Improvements
- ✅ Current price in Range column
- ✅ RFLR rewards display ($ + RFLR)
- ✅ Pool share % in Liquidity column
- ✅ Range indicator (horizontal line + vertical bar)
- ✅ Active/Inactive tabs with proper filtering

---

## 🎯 **VOLGENDE STAPPEN (Roadmap)**

1. **Performance Optimizations**
   - [ ] Parallel RPC fetching in /api/pool/[tokenId]
   - [ ] Redis cache layer voor token prices
   - [ ] Lazy loading voor Pool Activity

2. **New Features**
   - [ ] APS rewards integration (paused, wacht op Enosys dev)
   - [ ] Claim fees functionaliteit
   - [ ] Pool creation date correction (via FlareScan)
   - [ ] APY calculation improvements

3. **UI/UX**
   - [ ] Loading skeletons voor alle pages
   - [ ] Error boundaries
   - [ ] Toast notifications
   - [ ] Dark/Light mode toggle

---

## ⚠️ **REGELS VOOR AI ASSISTANTS**

1. **LEES DIT BESTAND EERST** voordat je wijzigingen maakt
2. **CHECK "KRITIEKE BESTANDEN"** - Alleen aanpassen als expliciet gevraagd
3. **VOLG DATA FLOWS** - Begrijp welke services elkaar aanroepen
4. **RUN TEST CHECKLIST** - Na elke major change
5. **UPDATE DIT BESTAND** - Als je architectuur wijzigt
6. **COMMIT REGELMATIG** - Met duidelijke messages
7. **VRAAG BIJ TWIJFEL** - Liever vragen dan breken

---

**Laatste verificatie**: 24 oktober 2025, 22:45  
**Geverifieerd door**: Koen (gebruiker) + Claude (AI)  
**Status Homepage**: ✅ Werkend (Active/Inactive positions)  
**Status Pool Detail**: ✅ Werkend (Live chart + events)  
**Status Portfolio**: ✅ Werkend (Summary + aggregates)

