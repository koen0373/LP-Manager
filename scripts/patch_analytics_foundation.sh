#!/usr/bin/env bash
set -euo pipefail

# --- 0) Guards & setup ---
mkdir -p docs prisma/migrations scripts pages/api/analytics pages/api/demo

# --- 1) PROJECT_STATE updaten met taal & partnerhouding ---
PS="PROJECT_STATE.md"
touch "$PS"
if ! grep -q "## Communication & Markets" "$PS" 2>/dev/null; then
  cat >> "$PS" <<'MD'

## Communication & Markets
- **External comms (product, investors, B2B/B2C): English only.**  
- **User support in app & with Koen: Dutch.**
- Strategic partner posture: LiquiLab is a neutral UX/analytics layer that **surfaces** insights and deep-links to **execution on partner platforms** (Enosys, SparkDEX, BlazeSwap, etc.).  
- Social share cards must include **provider name as text** (no third-party logos unless explicitly approved).

MD
  git add "$PS"
fi

# --- 2) Adapter Data Contract + Observability docs ---
AD="docs/ADAPTERS.md"
touch "$AD"
if ! grep -q "## Adapter Data Contract v0.1" "$AD" 2>/dev/null; then
  cat >> "$AD" <<'MD'

## Adapter Data Contract v0.1

**Goal:** Normalize all provider data (DEX v3, staking, perps) so LiquiLab can analyse, advise, and demo wallets across platforms.

### Required Entities
- **Provider**: `{ slug, name, type, apiDocsUrl?, rateLimits }`
- **Market (Pool)**: `{ providerSlug, marketId, feeTierBps, token0{symbol,decimals,address}, token1{...}, poolAddress?, createdAt }`
- **MarketSnapshot (≤ hourly)**: `{ marketId, ts, price, tvlUsd, volume24hUsd?, incentiveUsd?, apyPct? }`
- **Position**: `{ onchainId, owner, marketId, status, lowerPrice, upperPrice, feeTierBps, createdAt }`
- **PositionSnapshot (≤ hourly)**: `{ positionId, ts, amount0, amount1, tvlUsd, unclaimedFees{token0,token1,usd}, incentivesUsd?, inRange }`
- **Computed (server-side allowed)**: IL, APY breakdown, range status, `staleSeconds`.

### Links (deep-link builders)
- `link.pool({ providerSlug, marketId })`
- `link.position({ providerSlug, positionId })`
- `link.claim({ providerSlug, positionId|marketId })`
- UTM schema: `utm_source=liquilab&utm_medium=app&utm_campaign=<flow>&utm_content=<providerSlug>-<id>-<action>`

### Error & Caching Rules
- Backoff on 429/5xx, per-host RPS caps, circuit breaker after 3 fails.
- Cache TTLs: price ≤60s, fees/incentives 60–300s, static 24h.
- Always return `staleSeconds`.

---

## Observability (Adapters)

**SLO:** 99.5% success (7-day), p95 latency ≤1200ms cached / ≤3000ms uncached.

**Metrics to emit**
- `adapter_requests_total{provider,route,status}`
- `adapter_latency_ms_p50/p95{provider,route}`
- `cache_hit_ratio{provider,route}`
- `stale_seconds{provider,entity}` (gauge)
- `errors_total{provider,kind}`

**Alerts**
- High error rate: `errors_total > 1% of adapter_requests_total` for 10m
- Staleness: `stale_seconds > TTL*3` for 15m
- Latency: `p95 > SLO` for 15m

MD
  git add "$AD"
fi

# --- 3) Data Catalog & Warehouse design ---
DC="docs/DATA_CATALOG.md"
if [ ! -f "$DC" ]; then
  cat > "$DC" <<'MD'
# Data Catalog (Analytics)

All analytics tables use a safe prefix (`analytics_`) to avoid clashes with app tables.

## Tables
- **analytics_provider**: providers (slug, name, type)
- **analytics_market**: normalized pools/markets per provider
- **analytics_market_snapshot**: hourly market KPIs (price, TVL, volume, incentives, APY)
- **analytics_wallet**: discovered wallets (first_seen, last_seen)
- **analytics_position**: normalized positions (owner -> wallet FK)
- **analytics_position_snapshot**: hourly position KPIs (tvl, fees, incentives, range state)
- **analytics_wallet_metrics_daily**: daily rollups per wallet (counts, tvl_usd, realized_fees_usd, avg_range_width, avg_apy)
- **analytics_market_metrics_daily**: daily rollups per market (tvl, active_positions, avg_apy)
- **analytics_discovery_log**: provenance of wallet discovery (source, provider, txHash, block, ts)

## Retention
- Snapshots: 13 months (hourly) then downsample to daily.
- Rollups: 3+ years.

## Privacy
- On-chain is public; we do **not** join with PII. Provide opt-out mechanism for inclusion in demos if a wallet owner requests.

MD
  git add "$DC"
fi

WH="docs/ANALYTICS_WAREHOUSE.md"
if [ ! -f "$WH" ]; then
  cat > "$WH" <<'MD'
# Analytics Warehouse

## Pipeline
1) **Ingest**: adapters fetch markets/positions; event scanners discover wallets (PositionManager-like contracts).
2) **Normalize**: map to Adapter Data Contract.
3) **Persist**: write snapshots hourly; dedupe by (entity_id, ts).
4) **Compute**: daily rollups (wallet & market).
5) **Serve**: API endpoints for dashboards & investor demos.

## Scheduling (cron-ish)
- Wallet discovery: every 30m per provider.
- Market snapshots: hourly.
- Position snapshots: hourly, throttled by active wallets.
- Rollups: daily at 02:00 UTC.

## Backfill
- Per provider: “sinceBlock” or earliest timestamp; chunked scans with moving window; resumable with checkpoints.

MD
  git add "$WH"
fi

# --- 4) Prisma models (analytics_* prefix) ---
SC="prisma/schema.prisma"
if ! grep -q "model analytics_wallet" "$SC" 2>/dev/null; then
  cat >> "$SC" <<'PRISMA'

/// -------- Analytics foundation (safe-prefixed) --------
model analytics_provider {
  id        BigInt @id @default(autoincrement())
  slug      String @unique
  name      String
  type      String   // dex_v3 | staking | perps
  createdAt DateTime @default(now())
  markets   analytics_market[]
}

model analytics_market {
  id           BigInt @id @default(autoincrement())
  providerId   BigInt
  provider     analytics_provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  providerSlug String
  marketId     String
  feeTierBps   Int
  token0Symbol String
  token1Symbol String
  poolAddress  String?
  createdAt    DateTime @default(now())
  snapshots    analytics_market_snapshot[]
  positions    analytics_position[]

  @@unique([providerSlug, marketId])
  @@index([providerId])
}

model analytics_market_snapshot {
  id            BigInt   @id @default(autoincrement())
  marketIdFk    BigInt
  market        analytics_market @relation(fields: [marketIdFk], references: [id], onDelete: Cascade)
  ts            DateTime @default(now())
  price         Decimal  @db.Decimal(38, 18)
  tvlUsd        Decimal  @db.Decimal(38, 18)
  volume24hUsd  Decimal? @db.Decimal(38, 18)
  incentiveUsd  Decimal? @db.Decimal(38, 18)
  apyPct        Decimal? @db.Decimal(38, 18)

  @@index([marketIdFk, ts])
}

model analytics_wallet {
  id         BigInt   @id @default(autoincrement())
  address    String   @unique
  firstSeen  DateTime @default(now())
  lastSeen   DateTime @updatedAt
  positions  analytics_position[]
  metrics    analytics_wallet_metrics_daily[]
}

model analytics_position {
  id           BigInt  @id @default(autoincrement())
  walletId     BigInt
  wallet       analytics_wallet @relation(fields: [walletId], references: [id], onDelete: Cascade)
  marketIdFk   BigInt
  market       analytics_market @relation(fields: [marketIdFk], references: [id], onDelete: Cascade)
  onchainId    String
  status       String
  lowerPrice   Decimal @db.Decimal(38, 18)
  upperPrice   Decimal @db.Decimal(38, 18)
  feeTierBps   Int
  createdAt    DateTime @default(now())
  snapshots    analytics_position_snapshot[]

  @@unique([marketIdFk, onchainId])
  @@index([walletId])
}

model analytics_position_snapshot {
  id              BigInt   @id @default(autoincrement())
  positionIdFk    BigInt
  position        analytics_position @relation(fields: [positionIdFk], references: [id], onDelete: Cascade)
  ts              DateTime @default(now())
  amount0         Decimal  @db.Decimal(38, 18)
  amount1         Decimal  @db.Decimal(38, 18)
  tvlUsd          Decimal  @db.Decimal(38, 18)
  feesToken0      Decimal  @db.Decimal(38, 18)
  feesToken1      Decimal  @db.Decimal(38, 18)
  feesUsd         Decimal  @db.Decimal(38, 18)
  incentivesUsd   Decimal? @db.Decimal(38, 18)
  inRange         Boolean

  @@index([positionIdFk, ts])
}

model analytics_wallet_metrics_daily {
  id                  BigInt   @id @default(autoincrement())
  walletId            BigInt
  wallet              analytics_wallet @relation(fields: [walletId], references: [id], onDelete: Cascade)
  day                 DateTime
  poolsCount          Int
  activePoolsCount    Int
  tvlUsd              Decimal  @db.Decimal(38, 18)
  realizedFeesUsd     Decimal  @db.Decimal(38, 18)
  avgApyPct           Decimal? @db.Decimal(38, 18)
  avgRangeWidthRatio  Decimal? @db.Decimal(38, 18)

  @@unique([walletId, day])
  @@index([day])
}

model analytics_market_metrics_daily {
  id               BigInt   @id @default(autoincrement())
  marketIdFk       BigInt
  market           analytics_market @relation(fields: [marketIdFk], references: [id], onDelete: Cascade)
  day              DateTime
  tvlUsd           Decimal  @db.Decimal(38, 18)
  activePositions  Int
  avgApyPct        Decimal? @db.Decimal(38, 18)

  @@unique([marketIdFk, day])
  @@index([day])
}

model analytics_discovery_log {
  id          BigInt   @id @default(autoincrement())
  source      String   // e.g. enosys-v3:PositionManager
  provider    String
  txHash      String?
  block       BigInt?
  wallet      String
  marketId    String?
  ts          DateTime @default(now())

  @@index([provider, ts])
}
PRISMA
  git add "$SC"
fi

# --- 5) API placeholders ---
AS="pages/api/analytics/summary.ts"
if [ ! -f "$AS" ]; then
  cat > "$AS" <<'TS'
import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/src/server/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const [[wallets], [positions], [markets]] = await Promise.all([
      db.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS c FROM "analytics_wallet"`),
      db.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS c FROM "analytics_position"`),
      db.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS c FROM "analytics_market"`)
    ])
    res.status(200).json({
      ok: true,
      counts: { wallets: wallets?.c ?? 0, positions: positions?.c ?? 0, markets: markets?.c ?? 0 }
    })
  } catch (e:any) {
    res.status(200).json({ ok: true, placeholder: true, error: e?.message })
  }
}
TS
  git add "$AS"
fi

DEMO="pages/api/demo/portfolio.ts"
if [ ! -f "$DEMO" ]; then
  cat > "$DEMO" <<'TS'
import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/src/server/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const address = String(req.query.address || '').toLowerCase()
  if (!address) return res.status(400).json({ ok:false, error: 'address required' })
  try {
    const wallet = await db.analytics_wallet.findUnique({ where: { address } })
    if (!wallet) return res.status(200).json({ ok:true, positions: [], note: 'wallet not in analytics yet' })

    const positions = await db.$queryRawUnsafe<any[]>(`
      SELECT p.onchainId, m.providerSlug, m.marketId, m.token0Symbol, m.token1Symbol,
             s.tvlUsd, s.feesUsd, s.incentivesUsd, s.inRange, s.ts
      FROM analytics_position p
      JOIN analytics_market m ON m.id = p."marketIdFk"
      JOIN LATERAL (
        SELECT * FROM analytics_position_snapshot s
        WHERE s."positionIdFk" = p.id
        ORDER BY s.ts DESC
        LIMIT 1
      ) s ON true
      WHERE p."walletId" = $1
      ORDER BY s.ts DESC
    `, wallet.id)

    res.status(200).json({ ok:true, positions })
  } catch (e:any) {
    res.status(200).json({ ok:true, placeholder:true, error: e?.message })
  }
}
TS
  git add "$DEMO"
fi

# --- 6) ETL placeholder ---
ETL="scripts/etl_wallet_discovery.mjs"
if [ ! -f "$ETL" ]; then
  cat > "$ETL" <<'JS'
import { db } from '../src/server/db/index.js'
async function main() {
  console.log('Wallet discovery placeholder – wire to provider scanners.')
  // await db.analytics_wallet.upsert({ where: { address }, create: { address }, update: {} })
}
main().catch(e => { console.error(e); process.exit(1) })
JS
  git add "$ETL"
fi

# --- 7) Observability doc ---
OBS="docs/OBSERVABILITY_ADAPTERS.md"
if [ ! -f "$OBS" ]; then
  cat > "$OBS" <<'MD'
# Observability: Adapters & ETL

## Dashboards
- Adapter Health: requests by status, latency p50/p95, cache hits, staleSeconds gauge.
- ETL Throughput: rows/hour per table, lag vs schedule, backfill progress.
- Error Budget: 7-day rolling error rate vs 0.5% budget.

## Alerts (examples)
- adapter_error_rate > 1% for 10m
- etl_lag_minutes > 120 (market snapshots)
- stale_seconds > TTL*3 (any market)
MD
  git add "$OBS"
fi

git commit -m "analytics: adapter contract, observability docs, analytics_* schema, demo API placeholders" || true
