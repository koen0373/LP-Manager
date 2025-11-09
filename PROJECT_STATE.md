# PROJECT_STATE · LiquiLab Indexer & API (Concise)

> Living document for the LiquiLab Flare V3 indexer stack.  
> Last updated: 2025-11-09 06:00 CET. Target size ≤ 25 KB; archived snapshots live under `docs/ops/STATE_ARCHIVE/`.

---

## 1. Indexer Overview
- **Purpose:** Consolidated Flare V3 pipeline that ingests raw Ēnosys/Sparkdex NonfungiblePositionManager/pool events, enriches them, and feeds LiquiLab dashboards.
- **Mode (2025-11-09):** **Flare-only RPC** (no ANKR traffic). Middleware gate funnels all traffic to `/placeholder` until demo cookie set; `/placeholder` password is **Demo88**. Admin dashboards: `/admin/ankr` (cache-only stats) and `/admin/db` (table explorer, confirmation pending).
- **Architecture:** `CLI (backfill | follower)` → `IndexerCore` → `RpcScanner` → `Decoders (factory | pool | nfpm | state)` → `DbWriter` → Postgres (`PoolEvent`, `PositionEvent`, analytics tables). Streams still match Ēnosys/Sparkdex pools + NFPM + pool_state + position_reads.
- **Run modes:** Backfill (deterministic windows, stream-selectable) + follower tailer (12 s cadence, confirmation depth=2). Data lifecycle: raw NDJSON (180 d) → enriched JSON → Postgres (authoritative) → dashboards/APIs.
- **Routing:** Pure Pages Router (Next.js 15). Mixed App Router conflicts were resolved by removing `app/` directory and consolidating all API routes under `pages/api/`.

---

## Decisions (D#)
- **D-2025-11-06** — Documented Database configuration (source of truth) in PROJECT_STATE.md and aligned local/.env keys for `DATABASE_URL`, `RAW_DB`, `FLARE_API_BASE`, and `FLARE_RPC_URL`.
- **D-2025-11-06** — Added V3 addresses & Indexer scripts to PROJECT_STATE.md; confirmed DB config as source of truth and aligned .env keys (DATABASE_URL, RAW_DB, FLARE_API_BASE, FLARE_RPC_URL).
- **D-2025-11-06** — Documented Database configuration (source of truth) in PROJECT_STATE.md and aligned local/.env keys for `DATABASE_URL`, `RAW_DB`, `FLARE_API_BASE`, and `FLARE_RPC_URL`.
- **D-2025-11-06** — Added V3 addresses & Indexer scripts to PROJECT_STATE.md; confirmed DB config as source of truth and aligned .env keys (DATABASE_URL, RAW_DB, FLARE_API_BASE, FLARE_RPC_URL).

---

## 2. Key Components
- **CLI entrypoints:**  
  - `scripts/indexer-backfill.ts` — orchestrates batch runs, stream selection (factories, nfpm, pools), structured start logs. When `--streams=pools` is passed, now invokes `IndexerCore.indexPoolEvents`.  
  - `scripts/indexer-follower.ts` — resilient hourly tail; supports factory/pool catch-up plus NFPM stream by default.  
  - `scripts/dev/run-pools.ts` — dev runner for pool-events: `indexPoolEvents` from block 49,618,000 (or `--from`) to `latest - confirmations`, with optional `--dry` flag.
- **Core services:**  
  - `IndexerCore` — stream coordinators, checkpoint handling, pool registry integration. Exposes `indexPoolEvents({ fromBlock?, toBlock?, checkpointKey?, dryRun? })`.  
  - `RpcScanner` — viem-based `eth_getLogs` batching (batchSize=1000), adaptive concurrency (12→4), autoslow on HTTP 429.  
  - `factoryScanner` — decodes `CreatePool` / `PoolCreated`, caches block timestamps.  
  - `poolScanner` — decodes pool-contract Swap/Mint/Burn/Collect using `mapPoolEvent` helper.  
  - `dbWriter` — batch upserts for `PositionEvent`, `PositionTransfer`, `PoolEvent`.  
  - `poolRegistry` — resolves pool universe (PoolCreated rows ∩ optional allowlist).  
  - `pool_state` / `position_reads` stream helpers read slot0/liquidity & `positions(tokenId)` at `blockNumber: windowEnd`.
- **Mappers & decoders:**  
  - `src/indexer/mappers/mapPoolEvent.ts` — pure mapping function: decoded Uniswap V3 pool event args → `PoolEventRow` with stringified bigints, lowercase addresses, and numeric ticks.
- **ABIs:**  
  - `src/indexer/abis/factory.ts` (Uniswap V3 factories).  
  - `src/indexer/abis/pool.ts` (Swap/Mint/Burn/Collect).  
  - `src/indexer/abis/abis.ts` (NFPM events).  
- **Data paths & artefacts:**  
  - `data/raw/*.ndjson`, `data/enriched/*.json`, `logs/indexer-YYYYMMDD.log`.  
  - Configuration: `data/config/startBlocks.json`, optional `data/config/pools.allowlist.json`.  
  - Progress snapshots: `data/indexer.progress.json` (JSON with phase, stream, window).  
- **Resilience:** confirmation depth=2, reorg trim via checkpoints, autoslow with exponential backoff + jitter on 429, concurrency downshifts on repeated failures.

---

## 3. Database Schema Summary
- **Core tables:**  
  - `PoolEvent (id=txHash:logIndex)` — rows for `PoolCreated`, pool Swap/Mint/Burn/Collect. Columns: `pool`, `timestamp`, `eventName`, `sender`, `owner`, `recipient`, `tickLower`, `tickUpper`, `amount`, `amount0`, `amount1`, `sqrtPriceX96`, `liquidity`, `tick`.  
  - `PositionEvent` — Mint/Increase/Decrease/Collect (per tokenId & pool).  
  - `PositionTransfer` — ERC721 transfers across owners.  
  - `SyncCheckpoint` — per-stream progress (keys: `NPM:global`, `FACTORY:enosys|sparkdex`, `POOLS:all`, etc).  
  - `analytics_market`, `analytics_position`, `analytics_position_snapshot`, `metrics_daily_*` — derived KPI tables for TVL, APY, wallet adoption.  
  - Supporting tables: `PoolStateSnapshot`, `PositionSnapshot`, `User`, `Wallet`.
- **Relationships:**  
  - Factory events discover pools (`PoolCreated` → `PoolEvent.pool`).  
  - NFPM events produce `PositionEvent` + `PositionTransfer` (linked via tokenId).  
  - Pool-contract events feed `PoolEvent` for Swap/Mint/Burn/Collect analytics.  
  - Checkpoints enforce idempotent ingestion; `eventsCount` updated per batch.
- **Conventions:**  
  - Address storage: lower-case hex.  
  - Monetary columns stored as stringified integers (wei) in raw tables; analytics layer casts to numeric.  
  - BigInt-likes stored as strings to avoid JS precision loss.

---

## 4. Environment Variables
- **RPC:**  
  - `FLARE_RPC_URL` (primary; e.g. `https://rpc.ankr.com/flare/<apiKey>`).  
  - `FLARE_RPC_URLS` (comma-separated failover list, optional).  
- **DEX contracts:**  
  - `ENOSYS_V3_FACTORY` / `SPARKDEX_V3_FACTORY`.  
  - `ENOSYS_NFPM` / `SPARKDEX_NFPM` (NonfungiblePositionManager addresses).  
- **Database:** `DATABASE_URL` (Postgres; Railway / local).  
- **Indexer tuning (optional):**  
  - `INDEXER_CONCURRENCY`, `INDEXER_CHUNK`, `INDEXER_RPS` override defaults.  
  - `POOLS_ALLOWLIST` (path override), `INDEXER_START_BLOCK` (global fallback).  
- **Hosting:** Node / Next.js listens on `$PORT` per Railway requirement.  
- **Local assumptions:** macOS Sonoma/Sequoia + zsh, data directory at project root, external RPC accessible.

---

## 5. Configuration Defaults
- `indexer.config.ts`:  
  ```ts
  rpc: { batchSize: 1000, maxConcurrency: 12, minConcurrency: 4, requestTimeout: 30_000 }
  follower: { pollIntervalMs: 12_000, confirmationBlocks: 2, restartDelayMs: 5_000 }
  db: { batchSize: 1000, checkpointInterval: 25 }
  retry: { maxAttempts: 5, initialDelayMs: 250, backoffMultiplier: 2, maxDelayMs: 5_000 }
  ```
- Storage & retention: raw NDJSON retained 180 days; enriched snapshots kept until downstream BI export; Postgres analytics indefinite.  
- Railway / production runtime uses `pnpm run start` (`next start -p $PORT`).  
- Autoslow policy: base delay `ceil(1000 / rps)` with cap 15 s jitter; concurrency reduces after 3 consecutive failures.  
- Reorg mitigation: before each window the follower checks `windowStart-1`; if mismatch, entries ≥ reorgBlock trimmed and checkpoint rewound.

---

## 6. CLI Usage
```bash
# Backfill everything (factories + nfpm + pools + state readers)
pnpm exec tsx -r dotenv/config scripts/indexer-backfill.ts \
  --factory=enosys \
  --streams=factories,nfpm,pools,pool_state,position_reads \
  --from=29837200 --rps=8 --reset

# SparkDEX-only pools
pnpm exec tsx -r dotenv/config scripts/indexer-backfill.ts \
  --factory=sparkdex --streams=factories,pools --from=30717263

# Pools-only backfill (uses checkpoint POOLS:all)
pnpm exec tsx -r dotenv/config scripts/indexer-backfill.ts \
  --streams=pools --from=49618000

# NFPM tokenId spot backfill
pnpm exec tsx -r dotenv/config scripts/indexer-backfill.ts 23145 24890 --streams=nfpm

# Follower (polling tail across all factories + pools + nfpm)
pnpm exec tsx -r dotenv/config scripts/indexer-follower.ts --factory=all

# Dev runner: pool events only
pnpm exec tsx -r dotenv/config scripts/dev/run-pools.ts --from=49618000 --dry
```
- **Outputs:**  
  - Structured start JSON → stdout + `data/indexer.progress.json`.  
  - Rolling logs → `logs/indexer-YYYYMMDD.log`.  
  - Database writes → `PoolEvent`, `PositionEvent`, `PositionTransfer`, `PoolStateSnapshot`, `SyncCheckpoint`.

---

## 7. API & Analytics Layer
- **Public/partner APIs:**  
  - `GET /api/positions?address=0x…` — aggregated positions (Free tier masking applied; uses analytics snapshots).  
  - `GET /api/health` — reports provider status (RPC, mail, indexer freshness).  
  - `GET /api/indexer/progress` — exposes checkpoint/lag info (global + per-stream).  
  - `GET /api/intel/news` (Perplexity-powered web signals; not indexer but relies on Pool metadata).  
- **Analytics tables & metrics:**  
  - `analytics_market` (per provider, TVL, volume, APR).  
  - `analytics_position_snapshot` (tokenId share, inRange%, fee accrual, strategy width).  
  - `metrics_daily_pool` (TVL, fee APR, swap volume, unique LPs).  
  - Derived metrics:  
    • TVL (USD via DefiLlama price feeds)  
    • APY (feeYield + incentives)  
    • InRange% (tickLower/Upper vs current tick)  
    • Fee yield (daily fees / liquidity)  
    • Impermanent loss estimator (IL_est) vs hold baseline.  
  - Pool detail view uses: owner concentration, whale entries/exits, collect cadence, RangeBand strategy buckets (Aggressive/Balanced/Conservative), alerts readiness.

---

## 8. Testing & Verification
- **Performance envelope:** MacBook Pro M4 Pro (2024), Node 20/22, pnpm 9. Batch=1000 + concurrency=12 stable with ANKR RPC. Autoslow kicks in gracefully under rate limits.  
- **Backfill stats (latest full run):**  
  - Ēnosys NFPM: 239 474 events.  
  - SparkDEX NFPM: 231 963 events.  
  - PoolCreated rows: 404 (Ēnosys+SparkDEX combined).  
  - Pool-contract events (initial ingest): ~1.8 M Swap/Mint/Burn/Collect rows.  
- **Checkpoints:** `NPM:global`, `FACTORY:enosys`, `FACTORY:sparkdex`, `POOLS:all`, `POOL_STATE:enosys|sparkdex`, `POSITION_READS:global`.  
- **Block coverage:** min block ≈ 29,937,200 (Ēnosys launch) → max ≈ 50,180,000 (current head − confirmations).  
- **Verification commands:**  
  ```bash
  # Smoke tests
  pnpm exec tsx scripts/dev/indexer-smoke.mjs         # progress + NDJSON counts
  psql $DATABASE_URL -f scripts/dev/smoke-db-pool-events.sql  # pool events + checkpoints
  psql $DATABASE_URL -c "select eventname,count(*) from \"PoolEvent\" group by 1 order by 1;"
  psql $DATABASE_URL -c "select key,lastblock from \"SyncCheckpoint\" order by key;"
  
  # Unit tests (viem decode roundtrip + mapPoolEvent)
  pnpm exec vitest src/indexer/__tests__/poolDecode.spec.ts
  ```  
  - Continuous follower monitored via logs + `data/indexer.progress.json`.  
- **Known limitations:** Cloud sandbox DNS issues against `flare-api.flare.network` / `rpc.ankr.com` (local runs succeed); TypeScript `--noEmit` flagged legacy Jest tests lacking typings (tracked separately).

---

## 9. Next Work
- ✅ Pool-contract events indexed (Swap/Mint/Burn/Collect).  
- ✅ CLI backfill supports `--streams=pools` (invokes `IndexerCore.indexPoolEvents`).  
- ✅ Dev runner + smoke SQL + unit tests for pool decode flow.  
- ▶ Enrich analytics: inRange %, fee yield trend, IL% breakdown, pool cohort BI exports.  
- ▶ UI surfaces: PoolDetail deep dive (owner metrics, whale watch, alert toggles).  
- ▶ Automation: nightly `state:rotate` cron, weekly snapshots → `public/brand*.json`.  
- ▶ Ops: finalize transactional mail provider; integrate alerts pipeline once analytics stable.  
- ▶ BI exports: NDJSON dumps for `PoolEvent` / `PositionEvent` (quarterly).  
- ▶ Testing: upstream RPC alternates (Flare official) + CI smoke for indexer scripts.

---
# Data & Indexer Config
- **Database (local dev)**
  ```env
  DATABASE_URL="postgresql://koen@localhost:5432/liquilab?schema=public"
  RAW_DB="postgresql://koen@localhost:5432/liquilab"
  ```
- **RPC (Flare via ANKR)**
  - HTTPS: `https://rpc.ankr.com/flare/cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01`
  - WSS: `wss://rpc.ankr.com/flare/ws/cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01`
- **Uniswap v3 / NFPM addresses (Flare)**
  ```env
  ENOSYS_NFPM="0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657"
  SPARKDEX_NFPM="0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da"
  ENOSYS_V3_FACTORY="0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de"
  SPARKDEX_V3_FACTORY="0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652"
  ```

### NFPM (ERC-721) — Position NFTs (Flare)
- **Ēnosys NFPM (Flare)** — `0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657` — [Flarescan](https://flarescan.com/token/0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657?erc721&chainid=14) — canonical ERC-721 Position Manager for Ēnosys v3 pools (mints, transfers, burns LP NFTs).
- **Sparkdex NFPM (Flare)** — `0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da` — [Flarescan](https://flarescan.com/token/0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da?erc721&chainid=14) — Sparkdex Position Manager contract; mirrors Uniswap v3 semantics for Sparkdex pools.

#### .env — Indexer essentials
```env
# Flare RPC (Ankr)
FLARE_RPC_URL="https://rpc.ankr.com/flare/cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01"
FLARE_WS_URL="wss://rpc.ankr.com/flare/ws/cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01"

# NFPM (ERC-721 Position Manager)
ENOSYS_NFPM="0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657"
SPARKDEX_NFPM="0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da"
```

#### Verification
```zsh
PROJECT_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Liquilab"; cd "$PROJECT_DIR" || exit 1
node scripts/dev/verify-nfpm.mjs --nfpm=0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657 --id=12345
```
Expect JSON `{ nfpm, positionId, name, symbol, owner }`. Non-existent IDs or wrong NFPM emit a JSON error payload and exit code `1`.

## Data & Infra — ANKR Advanced API
- **Benefits:**  
  ✅ Faster RPC calls (no public rate limits)  
  ✅ Real-time token prices (<100 ms)  
  ✅ Multi-chain support (Flare, Ethereum, BSC, Polygon, …)  
  ✅ Historical price data with custom intervals  
  ✅ Whale watching (token transfer history)  
  ✅ WebSocket-ready for real-time feeds  
  ✅ Reliable uptime/performance (managed infra)
- **Endpoints & auth:** `https://rpc.ankr.com/multichain`, header `X-API-Key: $ANKR_ADV_API_KEY`, default chain `flare` (chainId 14).  
- **Environment:** `ANKR_ADV_API_URL`, `ANKR_ADV_API_KEY`, `FLARE_CHAIN_ID`.  
- **Repo usage:** client helper `src/lib/ankr/advancedClient.ts`, smoke script `scripts/dev/ankr-smoke.mts`, concurrency ≤ 6 with backoff on 429/5xx.  
- **Rate-limit policy:** respect ANKR Advanced quotas; throttle to ≤ 6 concurrent requests, exponential backoff on error.  
- **Docs:** see `docs/infra/ankr.md` for query examples and roadmap (enrich unknown pools/owners, nightly validation).

## Monitoring — ANKR API usage
- **API (`pages/api/admin/ankr.ts`):** fetches ANKR billing endpoint, caches responses in `data/ankr_costs.json` for 24 h, supports `?refresh=1` overrides, returns masked API key tail + history array for visualizations.
- **Dashboard (`pages/admin/ankr.tsx`):** dark-blue admin view (Brand guardrails) showing daily/monthly cost, total calls, last updated, force-refresh controls, and a simple trend chart using cached history.
- **Daily Ankr refresh job:** EasyCron hits `https://app.liquilab.io/api/admin/ankr?refresh=1` every day at **04:40 Europe/Amsterdam** (account timezone) so the cache stays fresh without manual visits. Railway fallback command: `node scripts/scheduler/ankr-refresh.ts`.
- **Scheduler script:** `scripts/scheduler/ankr-refresh.ts` — manual helper for Railway cron / local runs (invokes `/api/admin/ankr?refresh=1` and logs success/failure).

## Analytics: Position index (token_id)
- **Table:** `analytics_position` (token_id TEXT PK, owner_address, pool_address, nfpm_address, first_block, last_block, first_seen_at, last_seen_at).  
- **Purpose:** Canonical lookup of every Flare concentrated-liquidity position NFT (Ēnosys + Sparkdex) with latest ownership and pool association for downstream analytics & alerts.
- **Heuristic classifier:** `nfpm_address` derives from `first_block` — blocks `< 30617263` → Ēnosys NFPM (`0xD977…6657`), otherwise Sparkdex NFPM (`0xEE5F…27da`).  
  - **Follow-up:** replace with contract-address join once NFPM emitter is persisted in raw events.
- **Pool attribution:** primary source is `PositionEvent.pool` mode; fallback matches Mint events via `txHash + tickLower + tickUpper` against `PoolEvent` (`eventName='Mint'`).

### Runbook — tokenId→pool backfill & analytics_position_flat refresh
```zsh
# Apply latest prisma migration (idempotent)
PROJECT_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Liquilab"; cd "$PROJECT_DIR" || exit 1
pnpm prisma migrate deploy

# Backfill tokenId→pool for PositionEvent rows with pool='unknown'
# Strategy A: use PositionEvent MINT rows with known pool
# Strategy B: match PoolEvent.Mint via txHash + tickLower/tickUpper
export RAW_DB="postgresql://koen@localhost:5432/liquilab"
npm run sql:backfill:tokenid-pool

# Refresh analytics_position_flat materialized view
# Creates flat view: token_id, owner_address, pool_address, first_block, last_block, first_ts, last_ts
npm run sql:refresh:analytics-flat

# Verification (counts, top owners/pools, anomaly CSVs under /tmp)
npm run sql:verify:tokenid-pool
```
- **Success criteria:**  
  - `PositionEvent` rows with `pool='unknown'` reduced to near-zero after backfill.
  - `analytics_position_flat` row count matches distinct tokenIds in `PositionEvent ∪ PositionTransfer`.  
  - `owner_address` populated for tokens with transfers.  
  - `/tmp/liqui_positions_missing_pool.csv` contains only positions without any PoolEvent match.
  - `/tmp/liqui_positions_top_owners.csv` exports top 1000 owners by position count.

### Runbook — analytics_position refresh (legacy)
```zsh
# Backfill / refresh analytics_position (idempotent UPSERT)
psql "$RAW_DB" -f scripts/dev/backfill-analytics-position.sql

# Verification (counts, top owners/pools, anomaly CSVs under /tmp)
psql "$RAW_DB" -f scripts/dev/verify-analytics-position.sql
```
- **Success criteria:**  
  - `analytics_position` row count matches distinct tokenIds in `PositionEvent ∪ PositionTransfer`.  
  - `owner_address` populated for tokens with transfers; `nfpm_address` only contains Ēnosys/Sparkdex values.  
  - `/tmp/token_ids_without_owner.csv` empty after first full backfill (except never-transferred positions).  
  - `/tmp/tokens_bad_nfpm.csv` empty once NFPM emitter is stored.

### Indexing — ERC-721 tokenId→pool resolver (NFPM.positions + Factory.getPool)
- **Goal:** Resolve lingering `PositionEvent.pool='unknown'` rows by reading `positions(tokenId)` directly from Ēnosys/Sparkdex NFPMs, deriving pool address via both factories, and updating Postgres in-place.  
- **Script:** `scripts/dev/fix-pool-by-nfpm-viem.mts` (Viem + ANKR RPC; idempotent UPSERT).  
- **Env (.env.local):** quote values to avoid zsh expansion.
  ```env
  ANKR_HTTP_URL="https://rpc.ankr.com/flare/${ANKR_API_KEY}"
  ENOSYS_NFPM="0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657"
  SPARKDEX_NFPM="0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da"
  ENOSYS_V3_FACTORY="0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de"
  SPARKDEX_V3_FACTORY="0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652"
  DATABASE_URL="postgresql://koen@localhost:5432/liquilab?schema=public"
  RAW_DB="postgresql://koen@localhost:5432/liquilab"
  ```
- **Command:**
  ```zsh
  # Defaults: --limit=5000 --offset=0 --concurrency=10 (capped at 12 RPC calls)
  DOTENV_CONFIG_PATH=.env.local pnpm tsx scripts/dev/fix-pool-by-nfpm-viem.mts \
    --limit=7500 --offset=0 --concurrency=12
  ```
- **Behavior:**  
  - Fetches DISTINCT tokenIds where `PositionEvent.pool='unknown'` (batched window).  
  - Calls `positions(tokenId)` on Ēnosys NFPM, then Sparkdex if needed; for each response, tries both factories’ `getPool(token0, token1, fee)` until non-zero pool is found.  
  - Applies updates via single `UPDATE "PositionEvent" SET "pool"=$pool WHERE tokenId=$tokenId AND pool='unknown'`.  
  - Tracks counters (processed/resolved/skipped) and logs every 100 IDs; prints remaining unknown count via SQL at completion.  
  - Resumable via `--offset` pagination; safe to re-run (idempotent).  
- **Success criteria:**  
  - Remaining `PositionEvent.pool='unknown'` count steadily declines toward 0.  
  - `analytics_position_flat.pool_address` aligns with on-chain NFPM + factory readings (spot-check via verify script).  
  - NFPM RPC calls remain ≤ 12 concurrent; ANKR usage stays within plan limits.

### Analytics — Provider split (estimate)
We classify ERC-721 positions per provider (Ēnosys vs Sparkdex) using the *first seen block* of each tokenId (Sparkdex launch block **30617263**).  
Run:

```zsh
PSQL_URL="postgresql://koen@localhost:5432/liquilab"
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f scripts/dev/provider-estimate.sql
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f scripts/dev/verify-provider-estimate.sql
```

Outputs:
	• `analytics_provider_estimate(token_id, first_block, provider)` materialized view with indexes  
	• Totals per provider + coverage vs total tokenIds  
	• (Optional) top owners per provider if `analytics_position_flat` exists  

Next (accuracy): when NFPM address is stored per event/transfer, replace the first-block heuristic with address-based classification for perfect attribution.

### Portfolio & Core Actions (demo API + UI)
- **API — `/api/analytics/positions`:** paginated JSON feed backed by `analytics_position_flat` (fallback `analytics_position`). Supports `page`, `per`, `owner`, `pool`, `search` filters, clamps per 10‑200, returns `X-Total-Count` header.  
- **UI — `/portfolio`:** Client-side page with filters (owner/pool/tokenId), pagination controls, empty/error/loading states pulling from the API for demos.  
- **Docs:** Sidebar now points to “Portfolio & Core Actions” to guide Product/investors to the relevant roadmap section.

### Indexer — Architecture & Runbook
- **Reference doc:** `docs/indexer/architecture.md` (streams, storage layout, integrity rules, observability).  
- **Status:** All streams (factories, pools, NFPM, pool_state, position_reads) share the same 1,000 block window + 16-block confirmation buffer; cursors sync via `data/cursors.json`; raw NDJSON append-only with idempotent upserts.  
- **Commands (macOS/zsh):**
  ```zsh
  # Enosys full stream window
  pnpm exec tsx -r dotenv/config scripts/indexer-backfill.ts \
    --factory=enosys --from=29837200 \
    --streams=factories,pools,logs,nfpm,pool_state,position_reads \
    --rps=8 --confirmations=16 --reset

  # SparkDEX follow-up (no reset)
  pnpm exec tsx -r dotenv/config scripts/indexer-backfill.ts \
    --factory=sparkdex --from=30617263 \
    --streams=factories,pools,logs,nfpm,pool_state,position_reads \
    --rps=8 --confirmations=16
  ```
- **Observability:** track `data/indexer.progress.json`, tail `logs/indexer-YYYYMMDD.log`, `/api/indexer/progress` endpoint. Lossless raw files live under `data/raw/*`, enriched sets under `data/enriched/*`, analytics prep under `data/analytics/daily/*`.

## Runbooks
- **Backfill Ēnosys**
  ```zsh
  PROJECT_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Liquilab"; cd "$PROJECT_DIR" || exit 1
  pnpm exec tsx -r dotenv/config scripts/indexer-backfill.ts \
    --factory=enosys --from=29837200 \
    --streams=factories,logs,nfpm,pool_state,position_reads \
    --rps=8 --confirmations=32 --tokenIds="" --reset
  ```
- **Backfill Sparkdex**
  ```zsh
  PROJECT_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Liquilab"; cd "$PROJECT_DIR" || exit 1
  pnpm exec tsx -r dotenv/config scripts/indexer-backfill.ts \
    --factory=sparkdex --from=30617263 \
    --streams=factories,logs,nfpm,pool_state,position_reads \
    --rps=8 --confirmations=32 --tokenIds="" --reset
  ```
- **Sanity — pools mini-window**
  ```zsh
  PROJECT_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Liquilab"; cd "$PROJECT_DIR" || exit 1
  pnpm exec tsx -r dotenv/config scripts/dev/run-pools.ts --from=49618000 --to=49620000 || true
  ```
- **Sanity — DB queries (role koen)**
  ```zsh
  PROJECT_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Liquilab"; cd "$PROJECT_DIR" || exit 1
  export PSQL_URL="postgresql://koen@localhost:5432/liquilab"

  psql "$PSQL_URL" -F $'\t' -A -P pager=off <<'SQL'
  SELECT "eventName", COUNT(*) AS rows FROM "PoolEvent" GROUP BY 1 ORDER BY 2 DESC;
  SELECT "blockNumber","pool","eventName","txHash","logIndex",
         COALESCE("owner",'') owner, COALESCE("recipient",'') recipient,
         COALESCE("amount0",'0') amount0, COALESCE("amount1",'0') amount1,
         "tickLower","tickUpper","tick", COALESCE("sqrtPriceX96",'0') sqrtpx
  FROM "PoolEvent"
  WHERE "eventName" IN ('Swap','Mint','Burn','Collect')
  ORDER BY "blockNumber" DESC, "logIndex" DESC
  LIMIT 20;
  SELECT id,"lastBlock", to_char("updatedAt",'YYYY-MM-DD HH24:MI:SS') AS updated
  FROM "SyncCheckpoint"
  WHERE id LIKE 'POOLS:%' OR id LIKE 'FACTORY:%' OR id='NPM:global'
  ORDER BY "updatedAt" DESC
  LIMIT 10;
  SQL

  psql "$PSQL_URL" -F $'\t' -A -P pager=off <<'SQL'
  SELECT COUNT(*) AS bad_amount0 FROM "PoolEvent" WHERE "amount0" ~ '^-?[0-9]+-[0-9]+$';
  SELECT COUNT(*) AS bad_amount1 FROM "PoolEvent" WHERE "amount1" ~ '^-?[0-9]+-[0-9]+$';
  SQL
  ```
- **Daylog tail**
  ```zsh
  PROJECT_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Liquilab"; cd "$PROJECT_DIR" || exit 1
  LOG="logs/indexer-$(date +%Y%m%d).log"
  [ -f "$LOG" ] && tail -n 200 "$LOG" | grep -E '^\[RPC\] Scanning ' | tail -n 1 || echo "No daylog; see console output."
  ```

### Indexer Runbook (Flare, Enosys/Sparkdex)
- RPC (HTTPS): `https://rpc.ankr.com/flare/cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01`
- NFPM: Ēnosys `0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657`, Sparkdex `0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da`
- Factories: Ēnosys `0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de`, Sparkdex `0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652`
- Commands (examples):
  ```zsh
  pnpm exec tsx -r dotenv/config scripts/indexer-backfill.ts --factory=enosys  --from=29837200 --streams=factories,pools,nfpm,positions --rps=8 --confirmations=32 --reset
  pnpm exec tsx -r dotenv/config scripts/indexer-backfill.ts --factory=sparkdex --from=30617263 --streams=factories,pools,nfpm,positions --rps=8 --confirmations=32 --reset
  ```

### Analytics View (one row per NFT position)
- Create/refresh: `psql "$PSQL_URL" -f scripts/dev/backfill-analytics-position-flat.sql && psql "$PSQL_URL" -c 'REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_position_flat;'`
- Verify: `psql "$PSQL_URL" -f scripts/dev/verify-analytics-position-flat.sql`

## Changelog — 2025-11-08

### **ERC-721 Full Indexing + Pool Metadata Architecture**

**Database Migration (2025-11-08 12:00-14:45 CET):**
- ✅ Created new Railway Postgres database "switchyard" (50GB) after previous database crash
- ✅ Applied Prisma migrations (all tables created fresh)
- ⏳ **INDEXER RUNNING** — Full backfill in progress with ANKR RPC
  - Streams: `factories`, `pools`, `nfpm`
  - Progress: 132,000/242,300 events written (~54% complete)
  - ETA: ~45 minutes remaining
  - Database URL: `postgresql://postgres:***@switchyard.proxy.rlwy.net:52817/railway`

**Schema Changes:**
- ✅ Added `nfpmAddress` column to `PositionTransfer` table (distinguish Enosys vs SparkDEX)
- ✅ Created `Pool` table for pool metadata:
  - `address` (PK), `token0`, `token1`, `fee`
  - `token0Symbol`, `token1Symbol` (e.g. "WFLR/USDT")
  - `token0Name`, `token1Name`, `token0Decimals`, `token1Decimals`
  - `factory`, `blockNumber`, `txHash`
  - Indexes on `factory`, `token0+token1`, `blockNumber`

**New Scripts:**
- ✅ `scripts/dev/enrich-pools.mts` — Enriches Pool table with token metadata via RPC
  - Reads `PoolCreated` events from `PoolEvent`
  - Fetches ERC-20 symbol/name/decimals for token0 and token1
  - Usage: `tsx scripts/dev/enrich-pools.mts [--limit=100] [--offset=0]`
  - Rate limited: 100ms delay between pools to avoid RPC throttling

**Data Model Updates:**
- ✅ `eventDecoder.ts` — Added `nfpmAddress` to `DecodedTransfer` interface
- ✅ `dbWriter.ts` — Now writes `nfpmAddress` to `PositionTransfer` table
- ✅ `prisma/schema.prisma` — Added Pool model + nfpmAddress field

**Current Database Status (2025-11-08 14:45):**
```
✅ PositionEvent: 132,000 (INCREASE/DECREASE/COLLECT)
✅ PositionTransfer: 25,780 (NFT ownership transfers)
✅ PoolEvent: 404 (PoolCreated events only)
⏳ Pool contract events (Swap/Mint/Burn/Collect): Pending
⏳ Pool metadata enrichment: Pending (after indexer completes)
```

**Next Steps (After Indexer Completes):**
1. Verify all data: PositionEvent, PositionTransfer, PoolEvent counts
2. Run pool metadata enrichment: `tsx scripts/dev/enrich-pools.mts`
3. Verify pool names display correctly (e.g. "WFLR/USDT (0.05%)")
4. Setup Railway Indexer Follower for continuous updates
5. Implement RangeBand™ status API (IN_RANGE/NEAR_BAND/OUT_OF_RANGE)

**Known Issues:**
- Pool contract events (Swap/Mint/Burn/Collect) not yet appearing in database despite indexer scanning them
- Pool enrichment script will fetch metadata for 404 pools (~40 minutes with rate limiting)
- `poolCount: 0` in progress file suggests pool registry may not be populated yet

---

## Changelog — 2025-11-08 (Earlier)
• **ERC-721 Full Indexing** — Completed full historical backfill of all ERC-721 Transfer events from both Enosys V3 NFPM (`0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657`) and SparkDEX V3 NFPM (`0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da`). Total: 41,777 transfers, 24,432 unique NFT positions, 40,195 MINTs, 532 BURNs. Indexed locally using ANKR RPC (fast) and written directly to Railway Postgres (yamabiko). Earliest block: 29,989,866 (2025-04-13), latest: 50,289,944 (current).
• **Railway Database Migration** — Successfully migrated from crashed 500MB database (Postgres dc2e) to new 50GB database (yamabiko). Used external proxy URL for local indexing: `postgresql://postgres:tFXzfPtgqJpXOKbGBEiYeAstRdRdqAVF@yamabiko.proxy.rlwy.net:54929/railway`.
• **Indexer Follower Setup** — Added `indexer:follow:railway` npm script for continuous following using Flare Public RPC (free). Railway service configured with `Dockerfile.worker`, custom start command `npm run indexer:follow:railway`, and environment variables for both NFPMs.
• **RAILWAY_INDEXER_SETUP.md** — Created comprehensive deployment guide for Railway Indexer Follower service, including environment variables, troubleshooting, verification queries, and known issues (single NFPM scan limitation).
• **package.json** — Added `indexer:follow:railway` script: `tsx scripts/indexer-follower.ts --stream=nfpm`.
• **PROJECT_STATE.md** — Updated last modified date to 2025-11-08, added changelog entry for ERC-721 indexing completion and Railway setup.

**Database Status (2025-11-08):**
- 41,777 total transfers (Enosys + SparkDEX)
- 24,432 unique NFT positions
- 6,380 unique wallets
- Block range: 29,989,866 → 50,289,944
- Top wallet: `0xf406b4E97c31420D91fBa42a3a9D8cfe47BF710b` (501 transfers)

**Next Steps:**
1. Deploy Indexer Follower to Railway with Flare Public RPC
2. Monitor for 1 hour to ensure stability
3. Consider enhancing indexer to scan both NFPMs simultaneously (currently single contract per run)

## Changelog — 2025-11-07
• add scripts/dev/provider-estimate.sql — materialized view for per-provider split by first block (Sparkdex start 30617263).  
• add scripts/dev/verify-provider-estimate.sql — KPIs for provider coverage and (optional) top owners.  
• update PROJECT_STATE.md — provider split runbook + future NFPM-address follow-up.  
- add app/api/analytics/positions/route.ts — first analytics API for Portfolio demo (pagination, filters, total header).  
- add app/portfolio/page.tsx — UI table hitting the new API (filters, pagination, loading/error states).  
- update docs/_sidebar.md & public/docs/_sidebar.md — added explicit “Portfolio & Core Actions” link.  
- add docs/product/feature-roadmap.md — compiled LiquiLab feature roadmap (portfolio, alerts, analytics, UX) for product planning.  
- update PROJECT_STATE.md — referenced roadmap doc under Product & Roadmap section.  
- add public/docs/indexer/architecture.md — mirrored indexer architecture doc to unblock `/docs/indexer/architecture` route.  
- replace pages/api/mail/invoice|order|preview — stubbed mail endpoints with 503 response + `X-Mail-Stub` header for demo builds.
- add services/topPoolsCache.ts — minimal stub so `/pages/api/pools/top.ts` can import during demo builds.
- update tsconfig.json — broadened `@/*` alias to cover repo root + `src/` to fix Next.js resolve error.
- add pages/api/admin/ankr.ts — cached ANKR billing endpoint powering admin dashboard.
- add pages/admin/ankr.tsx — local dashboard for API key, usage, costs, and trend chart.
- add data/ankr_costs.json — persisted cache backing the 24 h refresh cycle.
- add scripts/scheduler/ankr-refresh.ts — Railway cron helper to refresh ANKR billing cache daily at 09:00 UTC.
- PROJECT_STATE.md — Captured Flare-only mode, placeholder/password gate, admin endpoints, EasyCron schedule, and open verification items.
- scripts/dev/fix-pool-by-nfpm-viem.mts — Added NFPM.positions + Factory.getPool resolver to classify remaining tokenIds directly from chain data.
- PROJECT_STATE.md — Documented ERC-721 resolver runbook, env keys, and operational flags under Analytics.
- scripts/dev/backfill-tokenid-pool.sql — Added tokenId→pool backfill pipeline (strategies A/B/A′) with required indexes.
- scripts/dev/refresh-analytics-flat.sql — Recreated analytics_position_flat materialized view (token_id, owner, pool, first/last block).
- scripts/dev/verify-tokenid-pool.sql — Added verification queries (counts, owner/pool coverage, Enosys/Sparkdex ranges).
- package.json — Added npm scripts to run the tokenId→pool backfill, analytics view refresh, and verification commands.
- app/layout.tsx — (NEW) Added root layout to satisfy Next 15 App Router build requirement (portfolio route now valid).
- app/globals.css — (NEW) Minimal brand-safe globals (antialiasing, tabular-nums, 100dvh).
- src/indexer/lib/rateLimiter.ts — (NEW) Token bucket rate limiter for RPC throttling (configurable RPS + burst).
- src/indexer/metrics/costMeter.ts — (NEW) Cost tracker for ANKR credits (10M credits = $1 USD; tracks eth_getLogs, eth_blockNumber, etc.).
- src/indexer/rpcScanner.ts — Added rate limiting, adaptive block window sizing (halves on 429/too large errors, floor 250), cost tracking per window, address chunking (20 per call).
- indexer.config.ts — Refactored to loadIndexerConfigFromEnv() with env + CLI overrides; added rpc.rps, rpc.concurrency, rpc.blockWindow, cost.creditPerUsd, cost.weights, allowlist.enabled; load from env (INDEXER_RPS, INDEXER_CONCURRENCY, INDEXER_BLOCK_WINDOW, COST_WEIGHTS_JSON, CREDIT_PER_USD, POOLS_ALLOWLIST).
- src/indexer/indexerCore.ts — Added getCostSummary() method to expose cost metrics from scanner.
- scripts/indexer-backfill.ts — Added CLI flags: --rps, --concurrency, --blockWindow, --cost-weights; start banner includes rps/concurrency/blockWindow/allowlistActive; final cost summary on exit.
- scripts/indexer-follower.ts — Added same CLI flags (--rps, --concurrency, --blockWindow) for consistency.
### NFPM ERC-721 indexing via ANKR
- **Env:** `ANKR_API_KEY`, `ANKR_HTTP_URL`, `ANKR_WSS_URL`, `ENOSYS_NFPM`, `SPARKDEX_NFPM`, `FLARE_CHAIN_ID`.  
- **Client:** `scripts/ankr/ankr-client.ts` (JSON-RPC helper for Advanced API).  
- **Indexer:** `scripts/dev/ankr-nfpm-scan.mts` pulls all tokenIds + transfers per NFPM, upserts into `PositionEvent` / `PositionTransfer`.  
- **Commands:**  
  ```zsh
  pnpm run scan:nfpm                        # Fetch NFPM tokenIds + transfer history via ANKR
  pnpm run sql:positions:refresh            # Rebuild analytics_position_flat (token ownership summary)
  pnpm run sql:positions:verify             # Counts + top owners/pools/nfpm distributions
  ```  
- **Success criteria:**  
  - `PositionEvent` contains minted rows (eventName='Mint') for every tokenId.  
  - `PositionTransfer` latest row per token matches `analytics_position_flat.owner_address`.  
  - Materialized view reports `transfer_events >= 1` for all active tokens.  
  - `/tmp` exports from verify script clean (manual `COPY` optional).

- **Known Issues / Gotchas**
  - P1013 invalid port / DSN errors: check for stray spaces or broken query string; prefer `DATABASE_URL="postgresql://koen@localhost:5432/liquilab?schema=public"`.
  - `role "postgres" does not exist`: use `koen` role locally (or create `postgres`).
  - Regex in psql must be single-quoted: `WHERE "amount0" ~ '^-?[0-9]+-[0-9]+$'`.
  - Pools runner is idempotent; no writes if already processed.
  - Concurrency is adaptive (max 12); `--rps=8` is safe on ANKR.
  - **ERC-721 NFPM transfers** not yet observed in latest backfill window — re-run NFPM stream (from block ~25,000,000) and confirm addresses.
  - **Pools indexer progress file** (`data/indexer.progress.json`) not confirmed in recent short runs — kick small pools backfill and verify it writes.

## Open Actions
- [P1] Verify `/admin/db` returns table list & rows in production (app router implementation live but pending confirmation).
- [P1] Re-run ERC-721 backfill with wider cursor (start ≤25,000,000) and confirm NFPM addresses + transfers emitted.
- [P2] Kick short pools-indexer scan and confirm `data/indexer.progress.json` is created/updated.
- [P3] Add health row on `/admin/ankr` exposing last cron execution result.
- [ ] Persist NFPM emitter address into PositionEvent/PositionTransfer and re-classify without heuristic.
- [ ] Improve pool matching for positions with pool_address IS NULL (txHash+ticks join & NFPM read).
- [ ] Add materialized view analytics_pool_24h once position table is stable.
- [ ] Run ANKR nightly validation job (sampled PositionTransfer owners vs ANKR responses).
- [ ] Design enrichment job to fill unknown pools/owners via ANKR Advanced API.
- [ ] Document pricing/cache retention strategy for ANKR-sourced token data.

## Brand & Pricing (reference)
- Visual guardrails: water-wave 100% visible, cards background `#0B1530`, Electric Blue primary, Aqua only as accent, `tabular-nums`, spacing tokens consistent.
- Pricing defaults (Nov 6, 2025): Base $14.95/mo for 5 pools, 14-day trial. Extra pools: $9.95/mo per 5. RangeBand™ Alerts: $2.49 per pool.

## Product & Roadmap Docs
- `docs/product/feature-roadmap.md` — investor/team-ready roadmap tables (Portfolio, Alerts, Analytics, UX). Dark-blue layout cues, aqua highlights, RangeBand™ terminology throughout.

## Changelog — 2025-11-06
- PROJECT_STATE.md — Documented NFPM contracts, Ankr .env essentials, verification flow, and open actions.
- scripts/dev/verify-nfpm.mjs — Added CLI helper to resolve NFPM `ownerOf(positionId)` via viem.
- prisma/migrations/20251106_analytics_position_init/migration.sql — Ensured analytics_position schema and indexes exist idempotently.
- scripts/dev/backfill-analytics-position.sql — Idempotent UPSERT pipeline syncing analytics_position from PositionEvent + PositionTransfer.
- scripts/dev/verify-analytics-position.sql — Verification queries & anomaly exports for analytics_position coverage.
- scripts/dev/backfill-analytics-position-flat.sql — Created materialized view analytics_position_flat with indexes.
- scripts/dev/verify-analytics-position-flat.sql — Added verification queries for analytics_position_flat coverage.
- docs/infra/ankr.md — Added ANKR integration playbook (benefits, endpoints, env, roadmap).
- README.md — Linked ANKR integration doc under Infrastructure.
- PROJECT_STATE.md — Captured ANKR Advanced API details, env keys, runbook, and follow-ups.
- scripts/ankr/ankr-client.ts — Minimal ANKR Advanced API JSON-RPC helper for NFPM scans.
- scripts/dev/ankr-nfpm-scan.mts — Backfill ERC-721 tokenIds/transfers for Ēnosys & Sparkdex NFPM contracts via ANKR.
- scripts/dev/refresh-analytics-positions.sql — Rebuild analytics_position_flat with ownership/event metrics & indexes.
- scripts/dev/verify-analytics-positions.sql — KPI checks and leaderboard queries for analytics_position_flat.
- prisma/migrations/20251106_analytics_position_flat/migration.sql — Seeded materialized view definition + supporting indexes.
- package.json — Added npm scripts for NFPM scanning and analytics_position refresh/verify.
- src/services/tvlService.ts — Replaced ANKR wallet balance approach with DefiLlama API for more accurate TVL data (Enosys, SparkDEX, BlazeSwap).
- src/services/tvlService.ts — Fixed TVL parsing bug: DefiLlama API returns chainTvls.Flare as number (current TVL), but tvl as array (historical). Now correctly handles both types and extracts numeric TVL.
- pages/api/stats/providers.ts — Updated logging to reflect DefiLlama as primary TVL source.
- src/services/poolCountHistory.ts — Fixed array handling to prevent crashes when history file is empty or corrupted.
- src/services/positionCountService.ts — (NEW) Fetches NFT position counts from FlareScan for Enosys and SparkDEX.
- pages/api/health.ts — Added position count integration via FlareScan (totalPositions for Enosys/SparkDEX providers).
- scripts/analytics/create-analytics-position-24h.sql — (NEW) Creates materialized view analytics_position_24h: daily rollup of ERC-721 position activity per pool (mints, burns, transfers, distinct positions, distinct wallets).
- scripts/analytics/refresh-analytics-position-24h.sql — (NEW) REFRESH CONCURRENTLY + show last 7 days.
- scripts/analytics/verify-analytics-position-24h.sql — (NEW) Verify MV size, indexes, data quality, pool coverage, unmapped pools.
- scripts/dev/backfill-tokenid-pool.sql — (NEW) Idempotent tokenId→pool backfill for PositionEvent rows with pool='unknown'. Strategy A: MINT rows with known pool. Strategy B: match PoolEvent.Mint via txHash+ticks. Creates 6 supporting indexes.
- scripts/dev/refresh-analytics-flat.sql — (NEW) Creates/refreshes analytics_position_flat MV: token_id (unique), owner_address, pool_address, first_block, last_block, first_ts, last_ts. Unique index for CONCURRENTLY refresh.
- scripts/dev/verify-tokenid-pool.sql — (NEW) Verification queries: PositionTransfer/PositionEvent counts, analytics_position_flat summary, top 10 owners/pools, CSV exports to /tmp.
- package.json — Added npm scripts: sql:backfill:tokenid-pool, sql:refresh:analytics-flat, sql:verify:tokenid-pool.
- PROJECT_STATE.md — Added tokenId→pool backfill runbook under "Analytics: Position index (token_id)" with npm run commands and success criteria.

## Changelog — 2025-11-09

### **SparkDEX NFPM Backfill Completed (Append-Only)**

**Date:** 2025-11-09 14:30-15:05 CET  
**Operation:** Append-only backfill of SparkDEX NFPM position transfers

**Results:**
- ✅ **60,563 SparkDEX transfers inserted** (0 duplicates, 0 errors)
- ✅ **50,421 unique SparkDEX positions** indexed
- ✅ **Block range:** 30,760,825 → 50,302,571
- ⏱️ **Runtime:** 14.65 minutes
- 🌐 **RPC Source:** ANKR (`cee6b4f8...`)
- 🔐 **Safety:** ON CONFLICT DO NOTHING (no updates/deletions)

**Final Database State:**
```
DEX        Positions   Transfers   Block Range
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Enosys     24,435      25,780      29,989,866 → 50,291,147
SparkDEX   50,421      60,563      30,760,825 → 50,302,571
Unknown    1           1           49,766,640
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL      74,857      86,344
```

**Technical Details:**
- Script: `scripts/backfill-sparkdex-safe.js`
- Method: Raw JSON-RPC (`eth_getLogs`) + Prisma `$executeRawUnsafe`
- Window: 5,000 blocks per request
- Rate: 6.67 RPS (150ms delay)
- Batch: 500 inserts per transaction
- UUID & timestamp generation for required schema columns

**Next Steps:**
1. ✅ Verify daily cron includes SparkDEX NFPM for future runs
2. ✅ Confirm aggregate counts in `/admin/db` dashboard
3. ⏳ Update `indexer.config.ts` to use array of NFPMs for unified scanning
4. ⏳ Test daily follower with both Enosys + SparkDEX

---

## Changelog — 2025-11-09

• **Railway Database Migration:** Migrated from crashed 500MB Railway database ("yamabiko") to new 50GB instance ("switchyard" → renamed to "Postgres"). DATABASE_URL updated to use variable references (`${{Postgres.DATABASE_URL}}`) for both LiquiLab and Indexer Follower services.
• **Full ERC-721 Data Indexing:** Completed backfill of historical ERC-721 position data (PositionTransfer + PositionEvent) for both Enosys and SparkDEX NFPMs from block 29,837,200 to 51,400,000+ using ANKR RPC. Database now contains **73,468 PositionTransfer** events and **49,012 distinct positions**.
• **Schema Enhancements:**
  - Added `nfpmAddress` column to `PositionTransfer` table to distinguish between Enosys and SparkDEX NFPMs.
  - Created `Pool` table with metadata (token0, token1, fee, symbols, names, decimals, factory, blockNumber).
  - Created `Token` model for reusable token metadata.
• **New Scripts:**
  - `scripts/dev/enrich-pools.mts` — Enriches Pool table with token metadata via RPC calls (symbols, names, decimals).
  - `scripts/ankr/fetch-factories-pools.mts` — Fetches PoolCreated events from factories and Mint/Burn/Collect events from pools.
  - `scripts/ankr/smart-pool-scanner.mts` — Two-phase scanner: quick scan to identify top 50 active pools, then full scan for those pools.
• **Railway Deployment:**
  - Created dedicated `Dockerfile.worker` for Indexer Follower service (avoids Next.js build, includes scripts/src/indexer.config.ts).
  - Fixed `tsx` dependency placement (moved from devDependencies to dependencies).
  - Configured Railway Cron Job for daily indexer backfills (8:00 AM CET).
  - Indexer Follower now uses Flare public RPC with reduced settings (RPS=2, Concurrency=2, BlockWindow=25) to comply with 30-block limit.
• **Placeholder Restoration:**
  - Re-created `pages/placeholder.tsx` with wave-hero background and modern glassmorphic login UI.
  - Middleware correctly redirects all traffic to `/placeholder` when `PLACEHOLDER_PASS` is set.
  - Access password: `Demo88`.
• **Vercel Migration:** Removed all Vercel-related configuration (`.vercel/`, `vercel.json`, `vercel.json.backup`). Project now fully deployed on Railway.
• **Documentation:**
  - Created `RAILWAY_INDEXER_SETUP.md` with detailed Railway configuration instructions.
  - Updated `HANDOVER_TO_CHATGPT.md` with latest indexer status, database credentials, and next steps.

## Changelog — 2025-11-07
• .env.local — Switched FLARE_RPC_URL from ANKR (`https://rpc.ankr.com/flare/...`) to Flare public RPC (`https://flare-api.flare.network/ext/bc/C/rpc`) to eliminate ANKR credit costs.
• indexer.config.ts — Already reads FLARE_RPC_URL from env; no code changes required.
• pages/api/analytics/positions.ts — Replaced old placeholder implementation with full analytics API (migrated from app/api/analytics/positions/route.ts). Supports pagination, filters (owner, pool, search), X-Total-Count header, fallback from analytics_position_flat → analytics_position.
• app/ directory — Deleted entire App Router directory to resolve Next.js 15 mixed routing conflicts (duplicate API routes, 500 errors on homepage/demo/pricing).
• PROJECT_STATE.md — Updated indexer overview with Flare public RPC and routing architecture (pure Pages Router).
• Test results — Verified /, /demo, /pricing, /api/analytics/positions all return 200 with no runtime errors.

**Recommended indexer settings for Flare public RPC:**
```bash
export INDEXER_RPS=3
export INDEXER_CONCURRENCY=4
export INDEXER_BLOCK_WINDOW=500
```

**Railway worker update:** Set FLARE_RPC_URL, INDEXER_RPS, INDEXER_CONCURRENCY, INDEXER_BLOCK_WINDOW in Railway dashboard env vars.

---

**SILENT policy reminder:** Codex/Claude deliverables must remain `PROJECT_STATE.md` + `[PASTE BLOCK — RESULTS FOR GPT]`.  
**Rotation rule:** keep last 7 daily changelog entries inline; archive older snapshots under `docs/changelog/YYYY/`.

---

<!-- CHANGELOG_ARCHIVE_INDEX -->
See archives in /docs/changelog/.

## Changelog — 2025-11-09
- prisma/migrations/20251109_mv_pool_latest_state/migration.sql — Added latest-state materialized view for pool tick/liquidity snapshots.
- prisma/migrations/20251109_mv_pool_fees_24h/migration.sql — Added 24h fees materialized view with pool index for concurrent refreshes.
- pages/api/demo/pools.ts — Rebuilt endpoint to prefer Railway Postgres views with snapshot fallback and 60s caching.
- pages/api/demo/history.ts — Added read-only history endpoint exposing 24h deltas from demo.history.json.
- scripts/cron/update-demo-history.ts — New cron helper that appends TVL/pool totals once every 20h+ with 14-day retention.
- public/demo.history.json — Seeded history file for API + cron to read/write.
- PROJECT_STATE.md — Recorded prospect endpoint rollout and linked artefacts in changelog.

## Changelog — 2025-11-09
- src/lib/entitlements/resolveRole.ts — Added canonical resolver with query/header/cookie overrides plus premium/analytics flags.
- pages/api/entitlements.ts — Wired resolver output (role, flags, source) into pricing/entitlements response.
- pages/api/positions.ts — Applied role-aware masking + entitlements metadata and hardened cache to return canonical data per role.
- src/lib/positions/types.ts — Extended summary contract with entitlements block for client awareness.
- src/components/dev/RoleOverrideToggle.tsx — Lightweight dev toggle to set ll_role cookie and reload locally.
- pages/index.tsx — Prospect home now respects ?role overrides, updates PoolsTable entitlements, and exposes the dev toggle.
- pages/dashboard.tsx — User home reads role override, surfaces current state badge, and reuses the dev toggle.

## Changelog — 2025-11-09
- pages/koen.tsx — Fixed entitlement fallback display from 'FREE' → 'VISITOR' to match new role model.
