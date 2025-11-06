# LP Manager - Enosys V3 Liquidity Pool Manager

## 🚀 Quick Start

---

## ⚙️ Deployment & Workers

### Infrastructure
- [ANKR Integration (Advanced API)](docs/infra/ankr.md)

### Railway Deployment

This application uses a **dual-service architecture** on Railway:
1. **Web Service** - Next.js application serving the UI and API
2. **Backfill Worker** - Background worker for ingesting blockchain events

#### Setup Instructions

**1. Create Railway Project**
- Connect your GitHub repository to Railway
- Create two services from the same repository:

**2. Web Service (Next.js App)**
```
Service Name: liqui-web
Build Command: (default)
Start Command: npm start
```

**3. Backfill Worker Service**
```
Service Name: liqui-backfill-worker
Build Command: (default)
Start Command: bash -lc "npm run backfill:run"
```

**4. Environment Variables (Both Services)**

Set these environment variables on **both** services:

```bash
# Database (automatically set by Railway Postgres add-on)
DATABASE_URL=postgresql://...

# Admin API Security (REQUIRED - generate a strong random value)
ADMIN_SECRET=your-strong-random-secret-here

# Flarescan API
FLARESCAN_API_BASE=https://flare-explorer.flare.network/api
FLARESCAN_API_KEY=  # Optional

# RPC Endpoint
RPC_URL_FALLBACK=https://flare-api.flare.network/ext/C/rpc

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id
```

**5. Add PostgreSQL Database**
- In your Railway project, click "New" → "Database" → "PostgreSQL"
- Railway will automatically inject `DATABASE_URL` into both services

**6. Deploy**
- Push to `main` branch
- Web service starts automatically
- Worker service runs backfill and exits (or runs continuously if configured)

---

### 🔄 Backfill Options

#### Option A: Railway Worker Service (Recommended)

Create a second service that runs the backfill continuously or on-demand:

```bash
# One-time backfill
Start Command: bash -lc "npm run backfill:ids"

# Continuous indexer (future)
Start Command: bash -lc "npm run indexer:loop"
```

#### Option B: HTTP Trigger via Admin API

Trigger backfill manually or via automation:

```bash
curl -X POST "https://your-app.railway.app/api/admin/backfill" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIds": [22003, 22326, 20445, 21866],
    "secret": "your-admin-secret",
    "mode": "since"
  }'
```

Response:
```json
{
  "success": true,
  "summary": {
    "total": 4,
    "successful": 4,
    "failed": 0,
    "totalInserted": 127,
    "totalUpdated": 5,
    "totalSkipped": 3,
    "elapsedMs": 4523
  },
  "results": [...]
}
```

#### Option C: GitHub Action (Automated)

A GitHub Action automatically triggers backfill after each deploy to `main`:

```yaml
# .github/workflows/post-deploy-backfill.yml
# Runs automatically on push to main
# Can also be triggered manually via "Actions" tab
```

**Setup GitHub Secrets:**
1. Go to repository Settings → Secrets → Actions
2. Add secrets:
   - `PROD_URL`: `https://your-app.railway.app`
   - `ADMIN_SECRET`: (same value as Railway env var)

#### Option D: Railway Cron Schedule

For periodic catch-up (e.g., nightly backfill):

1. Railway Dashboard → Service → Cron
2. Schedule: `0 2 * * *` (2 AM daily)
3. Command: 
```bash
curl -X POST "$RAILWAY_PUBLIC_DOMAIN/api/admin/backfill" \
  -H "Content-Type: application/json" \
  -d '{"tokenIds":[22003,22326,20445,21866],"secret":"'"$ADMIN_SECRET"'","mode":"since"}'
```

---

### 🛠️ Local Backfill

Run backfill locally for development/testing:

```bash
# Backfill specific positions
npm run backfill:ids

# Custom token IDs
npm run backfill:run 22003 22326

# Full re-sync (ignore checkpoint)
npm run backfill:run 22003 -- --full

# Since specific block
npm run backfill:run 22003 -- --since=5000000
```

---

### 🔍 Backfill Architecture

**Key Features:**
- ✅ **Idempotent upserts** - Safe to run multiple times
- ✅ **Checkpointing** - Resumes from last sync point
- ✅ **Exponential backoff** - Handles rate limits gracefully
- ✅ **Concurrency control** - Limits parallel requests (p-limit)
- ✅ **Comprehensive logging** - Detailed progress tracking

**How It Works:**
1. Reads `BackfillCursor` from database (last synced block)
2. Fetches events/transfers from Flarescan API in chunks
3. Persists to database using idempotent upserts
4. Updates cursor for resume capability
5. Parallel processing with configurable concurrency

**Database Tables:**
- `PositionEvent` - Position-specific events (Mint, Burn, Collect, etc.)
- `PositionTransfer` - NFT ownership transfers
- `BackfillCursor` - Checkpoint tracking per tokenId

---

### 🚨 Troubleshooting

**Worker not running on Railway:**
- Check logs in Railway dashboard
- Verify `npm run backfill:run` works locally
- Ensure `DATABASE_URL` is accessible from worker service

**Admin API returns 401:**
- Verify `ADMIN_SECRET` matches in GitHub Secrets and Railway
- Check request body includes correct `secret` field

**Backfill fails with rate limits:**
- Default: 2 req/sec with exponential backoff
- Reduce concurrency in worker.ts if needed
- Consider adding `FLARESCAN_API_KEY` for higher limits

**Database connection errors:**
- Verify `DATABASE_URL` is set correctly
- Check PostgreSQL service is running on Railway
- Run `npx prisma generate` after schema changes

---

### Database Setup (Vercel Postgres)

This app uses PostgreSQL via Vercel Postgres for production deployment.

**For Vercel Deployment:**
1. Create a [Vercel Postgres](https://vercel.com/storage/postgres) database (free tier available)
2. Copy the `DATABASE_URL` from Vercel dashboard
3. Add it to your Vercel project's Environment Variables:
   - Key: `DATABASE_URL`
   - Value: `postgres://...` (from Vercel)
4. Deploy! Migrations run automatically during build

**For Local Development:**
```bash
# Option A: Use Vercel Postgres (recommended)
vercel env pull .env.local  # Pull DATABASE_URL from Vercel

# Option B: Use local PostgreSQL
# Add to .env.local:
# DATABASE_URL="postgresql://user:password@localhost:5432/liqui?schema=public"

# Option C: Use SQLite for quick testing
# Update prisma/schema.prisma:
# provider = "sqlite"
# url = "file:./dev.db"

# Then run:
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## Positions API (Canonical)

### Endpoint

**`GET /api/positions?address=0x…`**

Returns the canonical list of liquidity positions plus aggregate totals used by the pricing page, dashboard, and onboarding flows.

```bash
curl -sS -G \
  "https://your-app.railway.app/api/positions" \
  --data-urlencode "address=0x0000000000000000000000000000000000000000"
```

Example response (trimmed):

```json
{
  "success": true,
  "data": {
    "positions": [
      {
        "provider": "enosys",
        "marketId": "22003",
        "poolFeeBps": 30,
        "tvlUsd": 5123.42,
        "unclaimedFeesUsd": 14.6,
        "incentivesUsd": 8.1,
        "rewardsUsd": 22.7,
        "isInRange": true,
        "status": "in",
        "token0": { "symbol": "WFLR", "address": "0x..." },
        "token1": { "symbol": "USD₮0", "address": "0x..." },
        "category": "Active"
      }
    ],
    "summary": {
      "tvlUsd": 5123.42,
      "fees24hUsd": 14.6,
      "incentivesUsd": 8.1,
      "rewardsUsd": 22.7,
      "count": 1,
      "active": 1,
      "inactive": 0,
      "ended": 0
    },
    "meta": {
      "address": "0x…",
      "elapsedMs": 142
    }
  }
}
```

### Summary Fields

| Field | Description |
| ----- | ----------- |
| `tvlUsd` | Sum of current TVL across all positions |
| `fees24hUsd` | Outstanding/unrealised trading fees (USD) |
| `incentivesUsd` | Protocol incentives (rFLR/APS/etc.) in USD |
| `rewardsUsd` | `fees24hUsd + incentivesUsd` |
| `count` | Total number of positions | 
| `active`, `inactive`, `ended` | Counts per category (Active = TVL > 0) |

### Legacy endpoints

| Endpoint | Status | Notes |
| -------- | ------ | ----- |
| `/api/positions-v2` | 🔁 **307 redirect** | Includes `Deprecation: true` header. Sunset **2025-11-14**. |
| `/api/wallet/summary` | 🚫 **410 Gone** | Emits `Deprecation: true` + `Link: </api/positions>; rel="successor-version"`. Sunset **2025-11-14**. |
| `/api/demo/selection`, `/api/demo/pool-live`, `/api/demo/portfolio` | ⚠️ **Deprecated** | Emits periodic console warnings; slated for removal after positions consolidation. |

Use the canonical `/api/positions` endpoint for all new work.

## Wallet Summary Endpoint (Retired)

`/api/wallet/summary` now proxies to the canonical `/api/positions` logic, but it is marked **410 Gone** with deprecation headers and will be removed after **2025-11-14**. Use `fetchPositions()` from `src/lib/positions/client.ts` for all new integrations.

```bash
curl -i -sS -G http://localhost:3000/api/wallet/summary \
  --data-urlencode "address=0x0000000000000000000000000000000000000000"
```

Example response:

```
HTTP/1.1 410 Gone
Deprecation: true
Sunset: 2025-11-14
Link: </api/positions>; rel="successor-version"

{"success":false,"error":"This endpoint has been retired. Please use /api/positions instead.","placeholder":true}
```

## Diagnostic helper

Use the macOS/zsh-safe helper script to inspect the canonical endpoint quickly. Pass `--help` for usage details:

```bash
./scripts/dev/diagnose-positions.sh --address 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

Environment variables:

- `BASE_URL` *(optional)* — defaults to `http://localhost:3000`.

### Data Sources

The endpoint aggregates data from:
1. **Live Positions** (`getWalletPositions`) - Current TVL and accrued fees
2. **Position Transfers** (`PositionTransfer` table) - NFT ownership history
3. **Position Events** (`PositionEvent` table) - Historical events (mint, collect, etc.)
4. **Capital Flows** (`CapitalFlow` table) - Deposits, withdrawals, fee realizations

### TODO Items

- [ ] Implement data validation/transformation in hook
- [ ] Add error boundaries and retry logic
- [ ] Calculate realized fees from COLLECT events
- [ ] Build capital timeline from CapitalFlow entries
- [ ] Add computed metrics (30d performance, best/worst positions)
- [ ] Implement caching strategy for historical data

### Summary Page (`/summary`)

**Overview:**
Comprehensive portfolio dashboard showing aggregated metrics, positions, and activity history.

**Features:**
- ✅ Total cards: TVL, Realized Fees, Rewards, ROI
- ✅ Positions list with status indicators
- ✅ Recent activity timeline
- ✅ Loading and error states
- ✅ Wallet connection CTA
- 📊 Capital timeline chart (placeholder)

**Navigation:**
- Accessible via "Summary" link in header
- Click position cards to navigate to detail page

**TODO:**
- [ ] Add Recharts for capital timeline visualization
- [ ] Implement time range filters (7d, 30d, 90d, all)
- [ ] Convert positions to PositionsTable component
- [ ] Add sorting and filtering for positions
- [ ] Implement activity timeline with icons
- [ ] Add pagination for activity list

---

## Ledger Backfill & Sync

### Overview
The backfill script syncs historical position data into the ledger database for comprehensive tracking and analytics.

### Usage

**Sync a single position:**
```bash
npm run backfill 22003
```

**Sync multiple positions:**
```bash
npm run backfill 22003 22326 20445
```

**Enable verbose logging:**
```bash
npm run backfill 22003 -- --verbose
```

### What Gets Synced

1. **Position Transfers**: All NFT transfers (mints, transfers between wallets)
2. **Position Events**: Pool events related to the position (Mint, Burn, Collect, Swap, etc.)
3. **Metadata**: Block numbers, timestamps, amounts, USD values

### Data Tables

- **PositionEvent**: Tracks all position-specific events (MINT, INCREASE, DECREASE, COLLECT, BURN)
- **PositionTransfer**: Tracks NFT ownership changes
- **CapitalFlow**: Tracks deposits, withdrawals, and fee realizations (to be implemented)

### Implementation

The sync process:
1. Fetches position data from the Position Manager contract
2. Retrieves NFT transfer history from Flarescan
3. Fetches pool events from the pool contract (RPC)
4. Processes and deduplicates events
5. Bulk inserts into SQLite database with conflict-safe upserts

### Files

```
src/lib/sync/
└── syncPositionLedger.ts    # Main sync logic

src/lib/data/
├── positionEvents.ts         # Event data access layer
├── positionTransfers.ts      # Transfer data access layer
└── capitalFlows.ts           # Capital flow data access layer

scripts/
└── backfillLedger.ts         # CLI script

prisma/
└── schema.prisma             # Database schema
```

---

## Pool Detail – Milestone 0: Skelet + Dummy Data + Premium Gating

### Overview
The Pool Detail page provides comprehensive insights into individual liquidity pool positions. This milestone implements the complete UI skeleton with dummy data and premium feature gating.

### Features Implemented
- **Complete UI Skeleton**: All sections implemented with shadcn/ui components
- **Dummy Data Integration**: Mock data for all pool metrics and historical data
- **Premium Gating**: Blur overlay for premium features (IL analysis, rewards, activity)
- **Responsive Design**: Mobile-first design (≥320px) with Tailwind CSS
- **Interactive Elements**: Refresh and Claim Fees buttons with proper aria-labels
- **Loading States**: Skeleton components and error handling

### Technical Implementation
- **Route**: `/pool/[tokenId]` with server-side rendering and dummy data
- **Components**: `PoolPairDetail` with modular card-based layout
- **Types**: Complete TypeScript interfaces for all data structures
- **Premium System**: `usePremiumStatus` hook with overlay components
- **UI Components**: Cards, Badges, Buttons, Skeletons from shadcn/ui

### File Structure
```
src/features/poolDetail/
├── types.ts              # All TypeScript interfaces
├── usePremiumStatus.ts   # Premium status hook
└── PoolPairDetail.tsx    # Main component

pages/pool/
└── [tokenId].tsx         # Route with SSR and dummy data
```

### Testing Instructions
1. **Access Pool Detail**: Navigate to `/pool/22003` (or any token ID)
2. **Verify UI Rendering**: All cards should display with dummy data
3. **Test Premium Features**: IL, Rewards, and Activity cards should show blur overlay
4. **Responsive Testing**: Test on mobile (≥320px) and desktop viewports
5. **Button Functionality**: Refresh and Claim Fees buttons should work (with alerts)
6. **Loading States**: Verify skeleton components render during loading

### Current Status
- ✅ Complete UI skeleton implemented
- ✅ All TypeScript interfaces defined
- ✅ Premium gating with blur overlays
- ✅ Responsive design (≥320px)
- ✅ Dummy data for all sections
- ✅ Loading and error states
- ✅ Aria-labels and focus states

### Next Steps (Live Data Integration)
- Replace dummy data with real API calls
- Implement historical data fetching
- Add impermanent loss calculations
- Integrate with actual premium status API
- Add transaction activity tracking
- Implement fee claiming functionality
