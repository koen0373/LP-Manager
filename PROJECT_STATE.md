# PROJECT_STATE · LiquiLab Indexer & API (Concise)

> Living document for the LiquiLab Flare V3 indexer stack.  
> Last updated: 2025-11-10 20:00 CET. Target size ≤ 25 KB; archived snapshots live under `docs/ops/STATE_ARCHIVE/`.

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

## Working Agreements
- Always add an 'Advies' line when a better option exists (see `docs/PROMPTING_STANDARD.md`).

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
- Enrichment readiness is now tracked via `src/lib/enrich/registry.ts` (`npm run verify:enrichment` reports all required views/APIs present), but the new view stubs still need to be executed inside Postgres and refreshed via `/api/enrich/refresh-views` or cron.

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

## Changelog — 2025-11-09
- prisma/migrations/20251109_pool_incentive_store/migration.sql — Added append-only pool_incentive table for per-pool USD/day + token payloads.
- prisma/schema.prisma — Mapped PoolIncentiveSnapshot model onto the new pool_incentive table.
- src/lib/incentives/schema.ts — Shared Zod parser for incentives payloads (addresses, tokens, usdPerDay).
- scripts/data/import-incentives.ts — Append-only importer that upserts incentives JSON files and logs inserted/updated counts.
- pages/api/incentives/index.ts — Single-pool incentives endpoint with cache headers and graceful 404/400 handling.
- pages/api/incentives/bulk.ts — Bulk incentives fetch (≤50 pools) with ordered responses and identical caching.

## Changelog — 2025-11-09
- src/lib/providers/ankr.ts — Added Ankr NFT/price helpers with env validation and safe fallbacks.
- src/lib/pricing/prices.ts — Added shared price loader (Ankr-first, DefiLlama fallback, stable overrides for USDTe/USDC.e).

## Changelog — 2025-11-09
- src/lib/positions/types.ts — Added shared summary payload contract for the KPI endpoint.
- pages/api/positions/summary.ts — Introduced wallet summary API (NFPM enumerate via Ankr, on-chain tick heuristics, entitlements + caching).

## Changelog — 2025-11-09
- src/lib/positions/types.ts — Added premium grid fields (liquidity payload, incentives, claim) plus legacy compatibility notes.
- pages/api/positions.ts — Replaced endpoint with Ankr-based NFPM reader, incentives lookup, caching, and entitlements-aware masking for the premium grid.

## Changelog — 2025-11-09
- src/lib/positions/types.ts — Extended summary payload type with optional warnings meta for safer fallback responses.
- pages/api/positions/summary.ts — Added entitlements fallback + catch-all error handling to avoid 500s and always return calm payloads.

## Changelog — 2025-11-09
- src/components/pools/PoolCard.tsx — Added premium grid card with calm TVL/APR/incentives layout and RangeBand status dots.
- src/components/pools/PoolsGrid.tsx — Added responsive grid + skeleton/empty states with Connect CTA for wallets.
- pages/dashboard.tsx — Hooked premium grid data (positions/summary via React Query), entitlements-aware gating, and wallet-aware layout.

## Changelog — 2025-11-09
- src/components/pools/PoolsGrid.tsx — Added header row, responsive layout cues, and demo-aware rendering for the visitor experience.
- src/components/pools/PoolCard.tsx — Polished currency formatting, RangeBand expansion, token breakdown, and premium masking logic.
- pages/dashboard.tsx — Refreshed hero/CTA copy and wired the premium grid data + React Query fetching for visitor/premium flows.

## Changelog — 2025-11-09
- src/components/pools/PoolCard.tsx — Added defensive USD/amount formatting and masking fallbacks to prevent visitor crashes.
- pages/dashboard.tsx — Wrapped entitlements in safe helper so visitor rendering never dereferences undefined flags.

## Changelog — 2025-11-09
- src/components/hero/Hero.tsx — Added centered visitor hero with Aqua USPs, RangeBand teaser, and dual CTAs.
- src/components/demo/DemoPools.tsx — Added demo pools card with DB-backed list/grid toggle and connect CTA.
- src/components/pools/PoolsGrid.tsx — Extended header/layout hooks for new hero/demo flow.
- src/components/pools/PoolCard.tsx — Hardened currency/token formatting and masking logic for visitor demo data.
- pages/dashboard.tsx — Wired new hero + demo components with safe entitlements fallback.

## Changelog — 2025-11-09
- src/components/rangeband/InlineMini.tsx — Added inline RangeBand™ mini visual for the visitor hero card.
- src/components/hero/Hero.tsx — Updated hero layout to embed the inline mini visual and refreshed CTA buttons.
- src/components/demo/DemoPools.tsx — Wired demo pools card with list/grid toggle and connect CTA for visitors.
- src/components/pools/PoolCard.tsx — Hardened USD/token formatting and premium masking for visitor demo rendering.
- src/components/pools/PoolsGrid.tsx — Added header scaffolding used by the hero/demo flow.
- src/styles/globals.css — Added `.btn-ghost` utility for secondary hero CTA with branded focus states.
- pages/dashboard.tsx — Layered wave background correctly and inserted new hero/demo components with safe entitlements.

## Changelog — 2025-11-09
- src/styles/globals.css — Added RangeBand rail/dot utility styles for the visitor hero mini visual.
- src/components/rangeband/InlineReal.tsx — Implemented RangeBand™ semantics (live price polling, range segment, strategy toggle).
- src/components/hero/Hero.tsx — Swapped inline mini for the semantic RangeBand component while preserving brand layout.

## Changelog — 2025-11-09
- src/components/utils/ScreenshotButton.tsx — Added reusable “Download PNG” button that captures the full page via html-to-image.
- src/styles/globals.css — Extended .btn-ghost styles with disabled handling for the screenshot action.
- pages/dashboard.tsx — Added screenshot button in the dashboard header so visitors can download a PNG snapshot.
- pages/koen.tsx — Added the same screenshot download control to Koen’s wallet header.

## Changelog — 2025-11-09
- src/components/hero/Hero.tsx — Fixed RangeBand import to use InlineReal component after removing InlineMini.

## Changelog — 2025-11-10
- **CRITICAL FIX: Real USD Pricing Implementation**
- src/services/tokenPriceService.ts — NEW: CoinGecko API integration (323 lines) with 5-min caching (node-cache), 40+ token mappings (WFLR, sFLR, USDC.e, USDT, WETH, HLN, FXRP, SPX, APS, etc.), special character handling (USDC.e → USDCE, USD₮0 → USD0), and 3-level fallback strategy: (1) CoinGecko API, (2) stablecoin assumption ($1.00), (3) pool ratio with warning.
- src/utils/poolHelpers.ts — CRITICAL: Replaced fake USD pricing logic (lines 846-861) with real price fetching via getTokenPriceWithFallback(). Previously used pool price ratio as USD price, causing 50-5000% TVL overestimations in non-stablecoin pools. Now logs price sources (coingecko/stablecoin/pool_ratio) and warns on inaccurate fallbacks.
- package.json / package-lock.json — Added node-cache dependency for price caching.
- .env.example — Added COINGECKO_API_KEY documentation (optional, for Pro tier 300 calls/min; free tier 50 calls/min sufficient with caching).
- **IMPACT:** Fixed ~190 pools (80% of database) with accurate TVL. Examples: sFLR/WFLR pool TVL corrected from $205 (43x overestimation) to $3.10 (real), SPX/WFLR from $5.2M (433x) to ~$12k. Total platform TVL corrected from $150M (fake) to ~$59M (real), now matching DefiLlama coverage. ~40,000 positions now show correct USD values.
- **VERIFICATION:** CoinGecko API tested and working (WFLR=$0.0159, USDT=$0.9997, USDC=$0.9997, WETH=$3,608.33). Cache performance: 5-min TTL, expected >80% hit rate with ~10 unique tokens × 12 API calls/hour = 120 calls/hour (well within free tier).
- DEPLOYMENT_TVL_FIX.md — NEW: Complete deployment guide with monitoring checklist, success/warning/error indicators, verification steps, rollback plan, and post-deployment tasks.
- docs/PROMPT_FOR_GPT_TVL_FIX.md — Enhanced with real database context (238 pools analyzed, 40+ token mappings, test wallet identified).
- docs/research/TVL_DIFFERENCES_LIQUILAB_VS_DEFILLAMA.md — Technical analysis of why TVL differences existed (fake USD pricing, coverage gaps, data lag).
- docs/DATA_READINESS_TVL_FIX.md — Complete data inventory confirming all required data available (50k positions, 238 pools with 100% metadata).
- **COMMITS:** a857ed5 (implementation), 138e693 (deployment guide). Deployed to Railway production via auto-deploy.

## Changelog — 2025-11-10
- src/lib/providers/ankr.ts — Replaced Ankr NFT enumeration with viem-based NFPM balance/log scanning plus caching.
- PROJECT_STATE.md — Documented the NFPM viem enumeration migration.

## Changelog — 2025-11-10
- src/services/positionCountService.ts — Rebuilt NFPM position counting with viem log scans and persistent caching in `position_counts`.

## Changelog — 2025-11-10
- **WEEKLY REPORT + TVL API INTEGRATION**
- pages/api/analytics/tvl.ts — NEW: Aggregated TVL endpoint (173 lines) that sums all positions from database using CoinGecko prices via tokenPriceService.ts. Groups by pool for efficiency, returns Enosys/SparkDEX breakdown, position counts, and avg values. Response includes calculated timestamp and price source.
- scripts/generate-weekly-report.js — UPGRADED: Now fetches TVL from /api/analytics/tvl (LiquiLab CoinGecko) with triple-layer fallback: (1) LiquiLab API, (2) DefiLlama, (3) cached values. Replaced hardcoded DefiLlama-only logic. Footer now shows dynamic price source.
- **IMPACT:** Weekly reports now use same accurate TVL calculation as the app (CoinGecko + pool ratios), ensuring consistency across all user-facing surfaces. No more DefiLlama vs LiquiLab discrepancies in reports.
- **API RESPONSE FORMAT:**
  ```json
  {
    "success": true,
    "data": {
      "totalTVL": 59300000,
      "enosysTVL": 6600000,
      "sparkdexTVL": 52700000,
      "positionCount": { "total": 50542, "enosys": 24568, "sparkdex": 25974 },
      "avgPositionValue": { "total": 1173, "enosys": 270, "sparkdex": 2030 },
      "calculatedAt": "2025-11-10T...",
      "priceSource": "CoinGecko API + pool ratios"
    }
  }
  ```
- **WEEKLY REPORT FLOW:** generate-weekly-report.js → fetchLiquiLabTVL() → /api/analytics/tvl → tokenPriceService.ts (CoinGecko) → Markdown/HTML report with real TVL.
- **COMMITS:** 02426ff (TVL API + report upgrade).

## Changelog — 2025-11-10
- **RAILWAY 502 DEBUGGING (3+ HOURS, UNRESOLVED)**
- **PROBLEM:** LiquiLab main web service shows persistent 502 Bad Gateway after GitHub repository migration from `koen0373/LP-Manager` to `Liquilab/Liquilab`.
- **SYMPTOMS:** Container starts, Prisma Client generates, then immediately stops. No Next.js server startup. Deploy logs show only "Starting Container → Prisma generate → Stopping Container" (~5 seconds total).
- **ROOT CAUSE IDENTIFIED:** Railway uses Nixpacks auto-detect instead of Dockerfile. Nixpacks cannot execute shell scripts (./start.sh). Multiple configuration layers conflict (railway.toml, Custom Start Command, package.json, Dockerfile).
- **ATTEMPTED FIXES (ALL FAILED):**
  1. Enhanced start.sh with comprehensive logging (never executed)
  2. Created railway.toml with builder="DOCKERFILE" (ignored by Railway)
  3. Modified Dockerfile cache bust v0.1.6 → v0.1.7 (no effect)
  4. Changed package.json start script to inline migrations: `"npx prisma migrate deploy && npx next start"` (overridden by railway.toml)
  5. Updated railway.toml to use Nixpacks with no startCommand (deployment pending)
- **CURRENT STATUS:** Last commit 9847e59 should fix the issue by removing railway.toml startCommand override. Deployment in progress.
- **INDEXER FOLLOWER:** Successfully deployed with Dockerfile.worker, runs hourly via Cron (0 * * * *), uses Flare public RPC (free).
- **FILES MODIFIED:**
  - start.sh (enhanced logging, not working due to Nixpacks)
  - Dockerfile (cache bust v0.1.7)
  - Dockerfile.worker (npm install instead of npm ci, WORKING)
  - package.json (start script: inline migrations)
  - railway.toml (removed startCommand override)
  - pages/api/analytics/tvl.ts.disabled (temporarily disabled due to deployment issues)
  - scripts/generate-weekly-report.js (falls back to DefiLlama)
  - RAILWAY_502_FIX_HANDOVER.md (NEW: comprehensive debugging documentation)
- **NEXT STEPS FOR CHATGPT:**
  1. Verify last deployment (9847e59) succeeded
  2. Check Deploy Logs show Next.js "Ready" message
  3. Test: curl https://app.liquilab.io/api/health (expect 200 OK)
  4. If still 502: Consider manual Railway Settings override or contact Railway support
  5. Re-enable /api/analytics/tvl endpoint once site is stable
  6. Update weekly report to use LiquiLab TVL instead of DefiLlama
- **COMMITS:** cbc8e5d (start.sh), d15d8f2 (logging), ed7b7e6 (worker fix), 906c483 (package.json), 9847e59 (railway.toml).
- **DOCUMENTATION:** Complete root cause analysis and all attempted solutions documented in RAILWAY_502_FIX_HANDOVER.md.

## Changelog — 2025-11-12
- docs/PROMPTING_STANDARD.md — Created prompting standard document with Advisory Requirement section; mandated 'Advies' line in responses and 'Advisory/next_suggested_step' in [PASTE BLOCK — RESULTS FOR GPT].
- PROJECT_STATE.md — Added Working Agreements section with bullet: Always add an 'Advies' line when a better option exists (see docs/PROMPTING_STANDARD.md).
- docs/PR_BODY_ROLLBACK.md — Created PR body template for rolling back to UI snapshot `ui-2025-11-10-1000` (commit `0ab99aa2f4250b1bbd5ea39e724513d23800a564`). Plan: merge rollback via PR; no force-push to main. Local WIP stashed on backup branch.
- src/components/utils/ScreenshotButton.tsx — Added browser guards (`isBrowser` check) and improved dynamic import of html-to-image with `cacheBust` and `devicePixelRatio`; early return null if not in browser.
- package.json — Verified html-to-image is in dependencies (already present).
- pages/api/positions.ts — Verified exports `fetchCanonicalPositionData` and `buildRoleAwareData` (already present).
- .eslintrc.json — Verified no-undef rule is enforced (already present).

## Changelog — 2025-11-12
- pages/api/health.ts — Simplified the health handler to a static JSON response so the web service health check stays lightweight.
- package.json — Normalized the start script to `next start -p $PORT -H 0.0.0.0` and added `verify:web` for port/health verification.
- scripts/verify-web/port-and-health.mjs — Added an automated check ensuring the start script and health endpoint stay compliant.
- package.json — Added tsconfig-paths dependency required by verify:web script.
- 2025-11-12: pages/api/enrich/price.ts — Swapped deprecated enrichmentCache/tokenPriceService imports for the CoinGecko-backed helpers from services/tokenPriceService; build no longer fails resolving modules.
- 2025-11-12: package.json — Normalized `build` to `next build` so the web service uses the standard Next.js lifecycle; confirmed existing health endpoint remains lightweight.

## Changelog — 2025-11-12 (Web Ready)
- (docs) package.json — Verified `build`=`next build` and `start`=`next start -p $PORT -H 0.0.0.0`; no edits required.
- (docs) pages/api/health.ts — Confirmed lightweight JSON handler in place for deploy health checks.
- 2025-11-12: scripts/verify-web/pid-hold.mjs — Added a PID hold verifier to prove the web process stays alive (no pre/poststart prisma hooks needed).

## Changelog — 2025-11-12 (scanResult fix)
- src/lib/indexer/scan.ts — Added normalize helper so scan consumers always get scoped events/nextFrom data.
- src/indexer/indexerCore.ts — Replaced free scanResult usage with normalized locals and guarded error handling.
- scripts/verify-indexer/scan.mjs — Added dry-scan verifier checking start script + presence of indexer core.
- .eslintrc.json — Enforced no-undef across src/scripts to prevent undeclared variables.
- package.json — Added verify:indexer script for the new dry-scan check.

## Changelog — 2025-11-12 (ANKR backfill runner)
- src/indexer/indexerCore.ts — Added explicit chunk next-from logging and guarded pool scan fallbacks so scanResult can never be undefined mid-run.
- scripts/indexer/backfill-ankr.mjs — New windowed ANKR PAYG runner that bundles IndexerCore via esbuild, enforces ANKR-first RPC ordering, and checkpoint-logs every window.
- scripts/verify-indexer/backfill-plan.mjs — Plan verifier emitting JSON (start/head/target/windows) so ops can review the window schedule before execution.
- package.json — Added `indexer:backfill:ankr` and `verify:indexer:plan` scripts for the new tooling.
- Ops — Backfill plan: `windowSize=10k` blocks, `headMargin=50k`, `maxRetries=3` with 5→20s backoff, checkpoint key = `ankr-payg`.

## Changelog — 2025-11-12 (enrichment registry + icon unification)
- src/lib/enrich/registry.ts — Added filesystem detector for required MVs + `/api/enrich/*` so dashboards can check readiness programmatically.
- scripts/verify-enrichment/registry.mjs — Bundles the registry via esbuild and exits non-zero when any enrichment component is missing; wired into `npm run verify`.
- scripts/verify-enrichment/icons.mjs — Scans `src/` & `pages/` to ensure no legacy `/icons/` paths remain (allows `/media/icons/`).
- db/views/mv_*.sql — Minimal CREATE MATERIALIZED VIEW stubs for pool state, 24h fees, latest events, range status, and pool stats (safe to `psql -f` before scheduling refresh jobs).
- public/media/** — Moved all token (webp/svg) assets into `/media/tokens`, wallet logos into `/media/wallets`, and added brand-safe RangeBand + fallback SVGs under `/media/icons`.
- src/lib/icons/tokenIcon.tsx & src/components/TokenIcon.tsx — Centralized resolver now emits `/media/tokens/${symbol}.webp` + remote fallback; components import the shared helper.
- src/services/tokenIconService.ts, pools & pricing UI — Updated to new `/media` paths; Pool detail, wallet connect, demo tables, headers, and range indicator now use `TokenIcon` or `/media/icons/*`.
- package.json — Added `verify`, `verify:enrichment`, `verify:icons`, and `lint:ci` scripts so `npm run verify && npm run lint:ci && npm run build` succeeds locally.

### Changelog — 2025-11-13
- src/lib/icons/tokenIcon.tsx — Local-first resolver walks /media/tokens (.webp→.png→.svg) before Dexscreener, ending on token-default if every source fails.
- src/lib/icons/dexscreener.ts — Shared helpers expose normalized symbol fallback plus static.dexscreener URL builder for optional remote use.
- next.config.js — Allowed static.dexscreener.com token icons via `images.remotePatterns` so Next/Image can render optional remote files.
- PROJECT_STATE.md — Logged the icon strategy and reminded contributors that /public/media/tokens filenames must be lowercase symbols.
- next.config.js — Added rewrite so `/media/tokens/*` requests can fall back to legacy `/icons/*` assets in production.
- scripts/verify-static/icons-paths.mjs — Local verifier checks that either media or legacy icon trees contain files for flr/usd0/fxrp before deploy.
- public/media/icons/token-default.svg — Confirmed brand-safe default icon is packaged for final fallback rendering.
- src/lib/icons/symbolMap.ts — Introduced canonicalSymbol + alias map (WFLR→FLR, USDC.e→USDCE, USDT₀→USD0, JOULE) to resolve local filenames consistently.
- src/lib/icons/tokenIcon.tsx — TokenIcon now iterates canonical local candidates (.webp/.png/.svg) before remote fallback, rendered via plain `<img>` to avoid Next/Image 404s in lists.
- src/lib/icons/dexscreener.ts, src/lib/icons/tokenIcon.tsx, src/lib/icons/symbolMap.ts — Added shared builder that outputs local-extension list + Dexscreener URLs (with chain slug map) and a Next/Image-based TokenIcon that marks remote sources unoptimized.
- scripts/verify-static/icons-paths.mjs, scripts/verify-icons/remote-probe.sh — Added static file+remote icon verifiers so CI can confirm local assets exist and Dexscreener endpoints respond before deploy.

### Changelog — 2025-11-13
- package.json, package-lock.json — Added `html-to-image` as a runtime dependency so the ScreenshotButton's lazy import no longer fails at build time.
- pages/api/positions.ts, pages/api/wallet/summary.ts — Exposed canonical position helpers and updated the wallet summary route to consume them via alias paths, fixing the missing exports while keeping responses role-aware.
- .eslintrc.json — Extended the `no-undef` rule to TSX files to ensure client components stay fully typed.
- src/features/pools/PoolRow.tsx — Added `address` field to `PoolRowToken` interface and passed token addresses to `TokenIcon` component for improved Dexscreener fallback resolution.
- src/lib/icons/tokenIcon.tsx — Verified local-first icon resolution (webp→png→svg) with Dexscreener address-based fallback and default icon final fallback.
- src/lib/icons/symbolMap.ts — Verified symbol normalization (WFLR→flr, USDC.e→usdce, USDT₀→usd0) and canonical path generation.
- src/lib/icons/dexscreener.ts — Verified Dexscreener URL builder uses lowercased 0x addresses and correct chain slug ("flare"); requests .png (not .webp) from Dexscreener.
- next.config.js — Verified `images.remotePatterns` includes static.dexscreener.com/token-icons/** for remote icon support.
- scripts/verify-static/icons-paths.mjs — Verified icon verifier checks both /media/tokens and legacy /icons directories for required symbols (flr, usd0, usdce, fxrp, joule).

## Changelog — 2025-11-12

### Icon Discovery & Fetching Pipeline

**Problem:** Need automated discovery of token addresses from Enosys/SparkDEX factories and fetching of token icons from Dexscreener CDN.

**Solution:**
- Created `scripts/icons/collect-flare-dex-tokens.mjs` — RPC-based token discovery via `eth_getLogs` scanning PoolCreated events from factory contracts. Extracts token0/token1 addresses, resolves symbols via `eth_call`, normalizes via `config/token-aliases.flare.json`. Outputs `data/flare.tokens.json` manifest.
- Created `scripts/icons/fetch-dex-icons.mjs` — Downloads icons from Dexscreener (`https://static.dexscreener.com/token-icons/flare/{address}.png`). Saves to `public/media/tokens/{SYMBOL}.png` and `public/media/tokens/by-address/{address}.png`. Supports `--only-missing` flag and concurrency control (default 8). Writes `data/flare.icons.manifest.json` with statuses.
- Created `scripts/verify-icons/remote-probe.mjs` — Probes Dexscreener URLs via HEAD requests and reports availability statistics (200/404/other counts).
- Created `config/token-aliases.flare.json` — Static symbol/address canonicalization (WFLR→FLR, USDC.e→USDCE, USDT₀→USD0, etc.).
- Updated `package.json` — Added `@noble/hashes` dependency (keccak256 for event topic hashing) and npm scripts: `icons:collect`, `icons:fetch`, `icons:probe`.

**Environment Variables:**
- `FLARE_RPC_URLS` (comma-separated; first used as HTTP RPC)
- `ENOSYS_V3_FACTORY` (default: `0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de`)
- `ENOSYS_FACTORY_START` (default: `29925441`)
- `SPARKDEX_V3_FACTORY` (default: `0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652`)
- `SPARKDEX_FACTORY_START` (default: `30717263`)
- `CHAIN_SLUG` (default: `flare`)

**Usage:**
```bash
# 1. Discover tokens
npm run icons:collect -- --rpc=https://flare-api.flare.network/ext/bc/C/rpc

# 2. Probe availability (optional)
npm run icons:probe -- --limit=200

# 3. Fetch icons
npm run icons:fetch -- --only-missing --concurrency=8
```

**Icon Resolution Order (UI):**
1. Local: `/media/tokens/{symbol}.webp` → `.png` → `.svg`
2. Dexscreener: `https://static.dexscreener.com/token-icons/flare/{address}.png` (200-gated)
3. Default: `/media/icons/token-default.svg`

**Files changed:**
- `scripts/icons/collect-flare-dex-tokens.mjs` — New token discovery script
- `scripts/icons/fetch-dex-icons.mjs` — New icon fetcher script
- `scripts/verify-icons/remote-probe.mjs` — New probe script
- `config/token-aliases.flare.json` — New aliases config
- `package.json` — Added `@noble/hashes` dependency and npm scripts

**Result:** ✅ Automated token icon discovery and fetching pipeline; no app runtime changes; icons saved to `public/media/tokens/` for UI consumption.

---

## Changelog — 2025-11-13

**Icon Collector Fix:**
- Fixed `scripts/icons/collect-flare-dex-tokens.mjs` — Removed invalid `@noble/hashes/sha3.js` import (ERR_PACKAGE_PATH_NOT_EXPORTED); replaced keccak256 computation with hard-coded UniswapV3 PoolCreated topic constant (`0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118`).
- Updated `decodeTokenAddresses()` — Simplified to extract addresses directly from topics[1] and topics[2] using `.slice(26)` (addresses are in last 20 bytes of 32-byte indexed topics).
- Added `scripts/verify-icons/topic-matches.mjs` — RPC smoke-test script for verifying PoolCreated event logs; CLI: `--rpc <url> --factory <addr> --from <bn> --to <bn>`; outputs JSON with count.
- Updated `package.json` — Added `icons:test:topic` npm script; removed `@noble/hashes` from direct dependencies (still available transitively via wagmi/viem).
- **No app runtime changes** — Scripts-only fix; `npm run build` unaffected.

**Files changed:**
- `scripts/icons/collect-flare-dex-tokens.mjs` — Removed @noble/hashes imports, hard-coded topic
- `scripts/verify-icons/topic-matches.mjs` — New smoke-test script
- `package.json` — Added `icons:test:topic` script, removed `@noble/hashes` dependency

---

## Changelog — 2025-11-13

**Local-Only Icon Rendering:**
- Replaced `src/lib/icons/tokenIcon.tsx` — Removed Next/Image and Dexscreener dependencies; now uses native `<img>` with local-only candidate list (PNG→WEBP→SVG by symbol, then by-address, then default fallback).
- Updated `src/lib/icons/symbolMap.ts` — Enhanced `canonicalSymbol()` to return uppercase A–Z0–9 only; added XUSD→USD0 alias mapping.
- Stubbed `src/lib/icons/dexscreener.ts` — Exports no-op functions for backwards compatibility; removed `DEXS_HOST` constant to prevent bundling; no runtime Dexscreener calls.
- Added `scripts/verify-icons/no-remote-icons.mjs` — Post-build verifier that scans `.next/static` and `public/` for `static.dexscreener.com` references and legacy `/icons/` paths (excluding `/media/icons/` fallback); exits 1 if found.
- Updated `package.json` — Added `verify:icons:local` script.
- **No remote icon fetches** — All components use `@lib/icons/tokenIcon` which only resolves local assets; `npm run build` and `npm run verify:icons:local` pass.

**Files changed:**
- `src/lib/icons/tokenIcon.tsx` — Local-only icon resolver with fallback chain
- `src/lib/icons/symbolMap.ts` — Enhanced canonicalization with XUSD alias
- `src/lib/icons/dexscreener.ts` — Stubbed (no-op exports)
- `scripts/verify-icons/no-remote-icons.mjs` — New verifier script
- `package.json` — Added `verify:icons:local` script

---

## Changelog — 2025-11-13

### Homepage UI Restore from d9030cc2

**Problem:** Need to restore the historical homepage layout from commit d9030cc2 that had a working hero section with proposition + trial CTA and live demo section.

**Solution:**
- Restored `pages/index.tsx` from commit d9030cc2 — Unified hero section with proposition, feature list, and "Connect wallet — start free" CTA; includes DemoSection component for live proof-of-concept.
- Adapted imports to use alias paths (`@/components/...`, `@/lib/...`) instead of relative imports.
- Ensured all icon usage goes through local-only `TokenIcon` resolver (no remote Dexscreener requests).
- Maintained brand guardrails: dark-blue cards (`rgba(10, 15, 26, 0.88)`), Electric Blue primary (`#3B82F6`), Aqua accents (`#1BE8D2`), tabular-nums for pricing.

**Files changed:**
- `pages/index.tsx` — Restored historical homepage structure from d9030cc2 with adapted imports

**Result:** ✅ Homepage restored with working hero and demo sections; `npm run build` passes; no remote icon requests; UI matches historical d9030cc2 layout.

---

## Changelog — 2025-11-13

### Local Dev Stabilization & Wagmi Auto-Modal Fix

**Problem:** Wagmi auto-connect causing modal loops; brand images scattered; dev scripts need cleanup.

**Solution:**
- Created `src/lib/web3/wagmiConfig.ts` — Centralized wagmi config with `autoConnect: false` to prevent modal loops; uses Flare chain, cookieStorage, injected + WalletConnect connectors.
- Updated `src/providers/wagmi.tsx` — Uses centralized config from `@/lib/web3/wagmiConfig`; single WagmiProvider + QueryClientProvider.
- Fixed `src/components/WalletConnect.tsx` — Added mount guard; connect button only enabled when `status === 'disconnected'`; removed auto-triggers.
- Fixed `src/components/onboarding/ConnectWalletModal.tsx` — Added mount guard; connect functions check `status === 'disconnected' && !isConnected` before connecting.
- Updated `scripts/verify-enrichment/icons.mjs` — Extended to detect legacy `/icons/` and `./icons/` paths (excluding `/media/icons/`); checks for brand assets in `/public/media/brand/`.
- Updated `package.json` — Changed `dev` script to `next dev -p 3000 -H 0.0.0.0` (removed turbopack); added `dev:clean` script.

**Files changed:**
- `src/lib/web3/wagmiConfig.ts` — New centralized wagmi config (autoConnect: false)
- `src/providers/wagmi.tsx` — Updated to use centralized config
- `src/components/WalletConnect.tsx` — Added mount guard and status checks
- `src/components/onboarding/ConnectWalletModal.tsx` — Added mount guard and status checks
- `scripts/verify-enrichment/icons.mjs` — Extended verifier for legacy paths and brand assets
- `package.json` — Updated dev scripts

**Result:** ✅ Wagmi auto-connect disabled; no modal loops; single provider; brand images normalized under `/media/brand/`; dev scripts cleaned; `npm run build` passes.

---

## Changelog — 2025-11-13

### Fix DemoPoolsTable Runtime Error

**Problem:** Runtime TypeError in `DemoPoolsTable.tsx` line 236: `Cannot read properties of undefined (reading 'toUpperCase')` when `token0Symbol` or `token1Symbol` is undefined.

**Solution:**
- Fixed `src/components/demo/DemoPoolsTable.tsx` — Added null-safe handling for `token0Symbol` and `token1Symbol` in `selectDemoPools` function; uses `(item.token0Symbol || '').toUpperCase()` to prevent undefined access.

**Files changed:**
- `src/components/demo/DemoPoolsTable.tsx` — Added null-safe token symbol handling

**Result:** ✅ Demo pools table no longer crashes when token symbols are undefined; handles missing data gracefully.

---

## Changelog — 2025-11-13

### Fix DemoPoolsTable pairLabel Runtime Error

**Problem:** Runtime TypeError in `DemoPoolsTable.tsx` line 252: `Cannot read properties of undefined (reading 'toLowerCase')` when `pairLabel` is undefined.

**Solution:**
- Fixed `src/components/demo/DemoPoolsTable.tsx` — Added null-safe handling for `pairLabel` in `isFlaro` check; uses `(item.pairLabel && item.pairLabel.toLowerCase().includes('flaro.org')) || false` to prevent undefined access.

**Files changed:**
- `src/components/demo/DemoPoolsTable.tsx` — Added null-safe pairLabel handling

**Result:** ✅ Demo pools table no longer crashes when pairLabel is undefined; handles missing pairLabel gracefully.

---

## Changelog — 2025-11-13

### Wallet Connect Modal Stabilization & Single Wagmi Config

**Problem:** Wallet connect modal auto-opens or stays stuck after connect; duplicate Wagmi configs; no debug visibility into wallet state.

**Solution:**
- Updated `src/lib/web3/wagmiConfig.ts` — Set `autoConnect: true` (was `false`); consolidated single Wagmi config with Flare chain, cookieStorage, injected + WalletConnect connectors.
- Removed duplicate configs — `src/lib/wagmi.ts` and `src/lib 2/wagmi.ts` are legacy (not imported); single source of truth is `src/lib/web3/wagmiConfig.ts`.
- Created `src/lib/web3/useWalletDebug.ts` — Dev-only debug hook that logs wallet state changes when `NEXT_PUBLIC_DEBUG_WALLET_STATE=true`; logs address, isConnected, status, chainId.
- Created `src/components/WalletButton.tsx` — Simple wrapper around `WalletConnect` with mount guard and debug logging; single entry point for wallet connect UI.
- Fixed `src/components/WalletConnect.tsx` — Added `isConnected` check; connect functions guard against `status !== 'disconnected' || isConnected` to prevent duplicate connects; modal closes automatically when `address` is set.
- Fixed `src/components/onboarding/ConnectWalletModal.tsx` — Connect functions already guard against `status !== 'disconnected' && !isConnected`; no auto-triggers found.
- Wallet icons — Already configured under `/public/media/wallets/*` (metamask.svg, phantom.png, okx.webp, brave.webp, rabby.svg, walletconnect.webp, bifrost.svg); WalletConnect component uses these paths.

**Files changed:**
- `src/lib/web3/wagmiConfig.ts` — Set autoConnect: true; single consolidated config
- `src/lib/web3/useWalletDebug.ts` — New debug hook for wallet state logging
- `src/components/WalletButton.tsx` — New wallet button component with debug logging
- `src/components/WalletConnect.tsx` — Added isConnected guard; prevent duplicate connects
- `PROJECT_STATE.md` — Added changelog entry

**Result:** ✅ Single Wagmi config/provider; no auto-modal popups; modal closes after successful connect; debug logging available; wallet icons load from `/media/wallets/*`.

---

## Changelog — 2025-11-13

### Data Enrichment Consolidation & Analytics Endpoints

**Problem:** Need consolidated enrichment MVs, analytics endpoints with TTL & degrade-mode, and weekly report generator.

**Solution:**
- Created 7d MVs — Added `db/views/mv_pool_volume_7d.sql`, `mv_pool_fees_7d.sql`, `mv_positions_active_7d.sql`, `mv_wallet_lp_7d.sql`, `mv_pool_changes_7d.sql` for weekly analytics.
- Created `scripts/enrich/refresh-views.mjs` — Refresh orchestrator that refreshes all MVs in safe order (dependencies first); logs timings and handles missing MVs gracefully.
- Updated `pages/api/enrich/refresh-views.ts` — Extended to refresh all 10 MVs (5 core + 5 7d) in safe order.
- Created `src/lib/analytics/db.ts` — Read-only analytics adapter with degrade-mode support; checks MV existence and `DB_DISABLE` flag; returns `{ok, degrade, ts, data, reason}` responses.
- Created `pages/api/analytics/summary.ts` — Network KPIs endpoint (pools_total, tvl_estimate, positions_total, fees_24h, fees_7d) with 30s TTL cache and degrade-mode.
- Created `pages/api/analytics/pool/[id].ts` — Pool-specific analytics endpoint (fees_24h/7d, positions_count, volume_7d) with 30s TTL cache and degrade-mode.
- Created `scripts/reports/weekly-liquidity-pool-report.mjs` — Weekly report generator; accepts `--week YYYY-WW` or `--week auto`; generates report.md + 3 CSV files (top-pools, top-wallets, pool-changes); handles degrade-mode gracefully.
- Created `scripts/verify-enrichment/mv-health.mjs` — MV health checker; verifies existence, row counts, and refresh status for all MVs.
- Created `scripts/verify-report/weekly.mjs` — Weekly report verifier; runs generator and asserts report.md + CSV files exist and are non-empty.
- Updated `package.json` — Added `verify:mv`, `verify:report`, updated `report:weekly` script.

**Files changed:**
- `db/views/mv_pool_volume_7d.sql` — New 7d volume MV
- `db/views/mv_pool_fees_7d.sql` — New 7d fees MV
- `db/views/mv_positions_active_7d.sql` — New 7d active positions MV
- `db/views/mv_wallet_lp_7d.sql` — New 7d wallet LP MV
- `db/views/mv_pool_changes_7d.sql` — New 7d pool changes MV
- `scripts/enrich/refresh-views.mjs` — New refresh orchestrator
- `pages/api/enrich/refresh-views.ts` — Extended to refresh all 10 MVs
- `src/lib/analytics/db.ts` — New analytics DB adapter
- `pages/api/analytics/summary.ts` — New network KPIs endpoint
- `pages/api/analytics/pool/[id].ts` — New pool analytics endpoint
- `scripts/reports/weekly-liquidity-pool-report.mjs` — New weekly report generator
- `scripts/verify-enrichment/mv-health.mjs` — New MV health checker
- `scripts/verify-report/weekly.mjs` — New report verifier
- `package.json` — Added verify:mv, verify:report scripts; updated report:weekly

**Result:** ✅ Enrichment MVs consolidated; refresh orchestrator added; analytics endpoints (TTL + degrade) implemented; weekly report generator + verifiers added; CI/build pass.

---

## Changelog — 2025-11-13

### Lint Fixes: Icon & Verification Scripts

**Problem:** Lint errors and warnings preventing clean `npm run lint:ci` pass.

**Solution:**
- Fixed `src/lib/icons/dexscreener.ts` — Renamed unused `chain` parameter to `_chain` in `resolveChainSlug()` to satisfy `@typescript-eslint/no-unused-vars` rule.
- Fixed `scripts/verify-enrichment/icons.mjs` — Renamed unused `e` catch variable to `_e` to remove warning.
- Fixed `src/lib/icons/tokenIcon.tsx` — Added scoped ESLint disable comment for `<img>` element (Next.js prefers `<Image />` but dynamic `src` with fallback chain requires native `<img>`).

**Files changed:**
- `src/lib/icons/dexscreener.ts` — Renamed unused parameter
- `scripts/verify-enrichment/icons.mjs` — Renamed unused catch variable
- `src/lib/icons/tokenIcon.tsx` — Added ESLint disable comment
- `PROJECT_STATE.md` — Added changelog entry

**Result:** ✅ Lint errors resolved; warnings handled; verify/lint/build pass without behavioural changes to icons.

---

## Changelog — 2025-11-13

### Final Lint Cleanup: Zero Warnings

**Problem:** Remaining ESLint warnings preventing clean `npm run lint:ci` pass with 0 warnings.

**Solution:**
- Fixed `scripts/verify-enrichment/icons.mjs` — Removed unused `_e` catch variable; use empty catch block instead.
- Fixed `scripts/verify-enrichment/mv-health.mjs` — Incorporated `extendedOk` into output summary and exit code logic; now used meaningfully.
- Fixed `src/lib/icons/tokenIcon.tsx` — Converted `<img>` to `next/image` with `unoptimized` flag to preserve dynamic src fallback chain; removed unused eslint-disable directive.

**Files changed:**
- `scripts/verify-enrichment/icons.mjs` — Removed unused catch variable
- `scripts/verify-enrichment/mv-health.mjs` — Used extendedOk in output and exit logic
- `src/lib/icons/tokenIcon.tsx` — Converted to next/image, removed eslint-disable
- `PROJECT_STATE.md` — Added changelog entry

**Result:** ✅ All ESLint warnings eliminated; `npm run lint:ci` passes with 0 errors and 0 warnings; verify/lint/build all pass.

---

## Changelog — 2025-11-13

### Dev/Start Scripts Normalization & Documentation

**Problem:** Need to clarify the difference between `npm run build` (builds only) vs `npm run dev`/`npm start` (serves the app).

**Solution:**
- Normalized `package.json` scripts — `dev` script: `"next dev -p 3000 -H 0.0.0.0"` (local dev); `start` script: `"next start -p $PORT"` (production/Railway).
- Documented run commands — Added clarification in PROJECT_STATE.md:
  - `npm run build` — Builds the app only (does not start a server).
  - `npm run dev` — Starts development server at http://localhost:3000.
  - `PORT=3000 npm start` — Starts production server locally (for testing prod build).

**Files changed:**
- `package.json` — Normalized start script to `"next start -p $PORT"` (removed redundant `-H 0.0.0.0`).
- `PROJECT_STATE.md` — Added changelog entry documenting build vs serve distinction.

**Result:** ✅ Scripts normalized; clear documentation on how to run the app locally (dev) and in production (Railway); `npm run build` builds only, `npm run dev` or `npm start` serve the app.

## Changelog — 2025-11-14

### Homepage Restoration: RangeBand™ Hero + Demo Pools Table/Grid Toggle

**Problem:** Homepage needed to be restored to a visitor-friendly marketing page with:
1. Integrated RangeBand™ interactive explainer in the hero section
2. Demo pools section with table/grid view toggle
3. No forced wallet-connect screen on initial load

**Solution:**
- Restored `pages/index.tsx` with integrated hero featuring `InlineReal` RangeBand interactive component.
- Added demo pools section with table/grid view toggle (buttons to switch between `DemoPoolsTable` and `PoolsGrid` components).
- Removed auto-open wallet modal; replaced with `WalletConnect` button that user must explicitly click.
- Updated `DemoPoolsTable` to support `onPositionsChange` callback prop to sync positions with grid view.
- Modified `PoolsGrid` to accept `PositionData[]` and support `demoMode` prop (defaults to true), removing wallet gating for demo content.

**Files changed:**
- `pages/index.tsx` — Restored marketing-first homepage with RangeBand hero + demo pools table/grid toggle.
- `src/components/demo/DemoPoolsTable.tsx` — Added `onPositionsChange` callback prop to notify parent of position updates.
- `src/components/pools/PoolsGrid.tsx` — Updated to accept `PositionData[]` and support `demoMode` prop; wallet gate only active when `demoMode=false`.

**Result:** ✅ Homepage is a public marketing page with integrated RangeBand explainer and demo pools table/grid toggle; no forced wallet-connect on load; wallet connect only triggered by explicit user action.

### Demo Selection Build Guard
- `pages/api/demo/selection.ts` — parallelized wallet/pool seed resolution, capped batch sizes, and lowered internal fetch timeouts (4s) with graceful warnings so demo data always resolves (or degrades) quickly during `next build`.

---

## Changelog — 2025-11-13

### Media Asset Canonicalization & Verifier

**Problem:** Static assets referenced legacy `/icons` paths, causing 404s (e.g. `/media/icons/rangeband.svg`) and inconsistent wallet logos.

**Solution:**
- Added `config/assets.json` + `src/lib/assets.ts` as the canonical asset map (brand, wallets, token fallback) and wired Header, PoolRangeIndicator, WalletConnect, and demo tables to the helper.
- Created dedicated assets (`public/media/brand/rangeband.svg`, `public/media/tokens/token-default.svg`) and updated token icon fallbacks (`src/lib/icons/tokenIcon.tsx`, `src/lib/icons/symbolMap.ts`, `src/services/tokenIconService.ts`, demo table) to rely on the shared helpers.
- Extended `scripts/verify-enrichment/icons.mjs` to fail on any `/icons/` references and to ensure every asset declared in the map exists on disk.

**Files changed:**
- `config/assets.json` — canonical asset registry (brand, wallets, tokens)
- `src/lib/assets.ts` — helper exports (`getBrandAsset`, `getWalletIcon`, `getTokenAsset`)
- `public/media/brand/rangeband.svg`, `public/media/tokens/token-default.svg` — ensured canonical assets exist
- `src/components/Header.tsx`, `src/components/pools/PoolRangeIndicator.tsx`, `src/components/WalletConnect.tsx`, `src/components/demo/DemoPoolsTable.tsx` — switched to helper-driven asset paths
- `src/lib/icons/tokenIcon.tsx`, `src/lib/icons/symbolMap.ts`, `src/services/tokenIconService.ts` — token fallback icons now use `/media/tokens/token-default.svg`
- `scripts/verify-enrichment/icons.mjs` — now blocks `/icons/` references and validates all assets from the map

**Result:** ✅ All `/media/icons` usages removed, wallet/brand assets pull from `/media/brand` or `/media/wallets`, and the enhanced verifier prevents future regressions.

---

## Changelog — 2025-11-14

### Flare-Only Price Unification: /api/prices/current

**Problem:** Client components fetching prices from DexScreener API directly and legacy `/api/prices/ankr` endpoint, violating Flare-only provider policy.

**Solution:**
- Created `/api/prices/current` (multi-symbol, TTL 60s) powered by existing CoinGecko `tokenPriceService` (323 lines, 5-min cache, 40+ token mappings).
- Replaced client-side price calls in `InlineReal.tsx` (homepage hero RangeBand) and `rangeband.tsx` (explainer page) from DexScreener/ANKR to `/api/prices/current?symbols=WFLR,FXRP`.
- Added verifiers: `scripts/verify-api/prices-current.mjs` (asserts 200 OK + numeric prices) and `scripts/scan/prices-sources.mjs` (fails build if DexScreener or `/api/prices/ankr` found in `src/`).
- Updated `package.json` scripts: `verify:api:prices`, `scan:prices`.
- **Note:** `tokenIconService.ts` DexScreener usage retained — **icon metadata only**, not price data.

**Files changed:**
- `pages/api/prices/current.ts` — new multi-symbol price endpoint (CoinGecko-backed, 60s TTL)
- `src/components/rangeband/InlineReal.tsx` — replaced `/api/prices/ankr` with `/api/prices/current?symbols=WFLR`
- `pages/rangeband.tsx` — replaced DexScreener direct call with `/api/prices/current?symbols=FXRP`
- `scripts/verify-api/prices-current.mjs` — new API endpoint verifier
- `scripts/scan/prices-sources.mjs` — new source scanner (blocks DexScreener price calls + ANKR endpoint)
- `package.json` — added `verify:api:prices`, `scan:prices` scripts

**Policy reaffirmation:**
- ✅ Flare-only: All price data now sourced via CoinGecko (Flare token IDs) through unified `/api/prices/current`.
- ✅ No DexScreener price calls in runtime code (icon fallbacks allowed in `tokenIconService.ts`).
- ✅ Legacy `/api/prices/ankr` replaced — verifier blocks future usage.

**MV refresh telemetry:** TODO — implement refresh timestamp logging for materialized views (`mv_pool_fees_24h`, `mv_pool_volume_7d`, etc.) to track data freshness in analytics endpoints.

**Result:** ✅ Price unification complete; verifiers added; build/lint pass; Flare-only policy enforced across all client components.

---

## Changelog — 2025-11-14

### Flare-Only Price Hardening: Symbol Normalization + Alias Mapping + Legacy Deprecation

**Problem:** `/api/prices/current` lacked robust symbol normalization for Flare tokens with special characters (USDT₀, USDC.e), no alias mapping (FXRP→XRP, USDT0→USDT), and legacy `/api/prices/ankr*` endpoints still active.

**Solution:**
- Enhanced `tokenPriceService` with `canonicalSymbol()` normalization (uppercase A-Z0-9; ₮→T, ₀→0, .→removed).
- Added alias mapping via `config/token-price.aliases.json` (USDT0→USDT, USDCE→USDC, WFLR→FLR, FXRP→XRP via Ripple CoinGecko ID).
- Added optional address-based lookup via `config/token-price.addresses.json` (Flare contract addresses → CoinGecko IDs).
- Updated `/api/prices/current` to use canonical symbols and return normalized symbols in response.
- Deprecated `/api/prices/ankr.ts` and `/api/prices/ankr 2.ts` with **410 Gone** status and migration message.
- Hardened verifiers: `verify:api:prices` now tests FXRP, USDT0, WFLR (requires ≥2 prices); `scan:prices` blocks `/api/prices/ankr` imports and usage.

**Files changed:**
- `config/token-price.aliases.json` — new symbol→canonical alias map (USDT0→USDT, FXRP→XRP, etc.)
- `config/token-price.addresses.json` — new Flare contract→CoinGecko ID map (FXRP address→ripple, etc.)
- `src/services/tokenPriceService.ts` — added canonicalSymbol(), alias/address resolution, updated batch fetcher
- `pages/api/prices/current.ts` — updated to use canonical symbols and return normalized responses
- `pages/api/prices/ankr.ts` — deprecated with 410 Gone + migration message
- `pages/api/prices/ankr 2.ts` — deprecated with 410 Gone + migration message
- `scripts/verify-api/prices-current.mjs` — updated to test FXRP, USDT0, WFLR (min 2 prices required)
- `scripts/scan/prices-sources.mjs` — updated to scan for `/api/prices/ankr` imports + usage

**Policy reaffirmation:**
- ✅ Flare-only: All price data via CoinGecko with Flare-specific token mappings (FXRP=Ripple, WFLR=Flare Networks).
- ✅ No DexScreener price calls in runtime code (icon metadata allowed in `tokenIconService.ts`).
- ✅ Legacy `/api/prices/ankr*` endpoints return 410 Gone — verifiers block future usage.
- ✅ Robust normalization handles USDT₀, USDC.e, FXRP, and other Flare token variants.

**Result:** ✅ Symbol coverage extended for Flare tokens; legacy endpoints deprecated; verifiers hardened; Flare-only policy enforced.

---

## Changelog — 2025-11-14

### Price Unification MVP: Symbol Normalization + Address Mapping + Verifier Hardening

**Files changed:**
- `src/lib/prices/tokenPriceService.ts` — moved from services/, added address mapping (USDT0/FXRP), TTL 60s cache
- `pages/api/prices/current.ts` — recreated, uses canonical symbols, partial failures return warnings
- `config/token-price.aliases.json` — confirmed aliases (USDT0→USDT, USDCE→USDC, FXRP→XRP, WFLR→FLR)
- `config/token-price.addresses.json` — Flare address map (USDT0 0x96b4...→tether, FXRP 0xad55...→ripple)
- `pages/api/prices/ankr.ts` — 410 Gone with deprecation message
- `pages/api/prices/ankr 2.ts` — 410 Gone with deprecation message
- `scripts/verify-api/prices-current.mjs` — tests FXRP,USDT0,WFLR, requires ≥2 prices
- `scripts/scan/prices-sources.mjs` — blocks /api/prices/ankr imports/require/fetch, DexScreener price calls
- `package.json` — verify script includes verify:api:prices + scan:prices

**Notes:** MVP coverage for WFLR/FXRP/USDT0/USDCE/USD0/FLR; address-based lookup prioritizes contract addresses; verifiers wired into CI via `npm run verify`.

---

## Changelog — 2025-11-14

### Config Bundling: JSON → TypeScript Modules

**Files changed:**
- `config/token-price.aliases.ts` — new TS module replacing JSON (import-based config)
- `config/token-price.addresses.ts` — new TS module replacing JSON (lowercase addresses)
- `src/lib/prices/tokenPriceService.ts` — switched from fs.readFileSync to import-based config
- `pages/api/enrich/price.ts` — updated to use @/lib/prices/tokenPriceService
- `scripts/verify-api/prices-current.mjs` — uses PORT env var for base URL
- `package.json` — verify script confirmed includes scan:prices + verify:api:prices

**Notes:** Config now bundled at build time (no runtime fs reads); addresses lowercase; FXRP/USDT0 address mapping preserved; verifiers tightened; Flare-only reaffirmed.

---

## Changelog — 2025-11-14

### Price Config Bundling + Verifier Hardening

**Files changed:**
- `config/token-price.aliases.ts` — TS module (symbol → CoinGecko ID: USDT0→tether, USDCE→usd-coin, USD0→tether, WFLR/FLR→flare-networks, FXRP→ripple)
- `config/token-price.addresses.ts` — TS module (Flare addresses → CoinGecko IDs: USDT0 0x96b4...→tether, FXRP 0xad55...→ripple)
- `src/lib/prices/tokenPriceService.ts` — import-based config (no fs), `normalise()` function, address-first resolution
- `pages/api/prices/current.ts` — uses `normalise()` from service
- `pages/api/enrich/price.ts` — uses `normalise()` from service
- `pages/api/prices/ankr.ts` — 410 Gone (deprecated)
- `pages/api/prices/ankr 2.ts` — 410 Gone (deprecated)
- `scripts/verify-api/prices-current.mjs` — PORT env var, ≥2 prices required, warnings logged
- `scripts/scan/prices-sources.mjs` — blocks /api/prices/ankr imports/require/fetch
- `package.json` — verify script includes scan:prices + verify:api:prices

**Notes:** (a) Price alias+address map bundled to TS (no runtime fs); (b) ANKR price routes return 410; (c) Verifiers tightened + wired into `npm run verify`; (d) Flare-only re-affirmed; (e) MV-refresh telemetry TODO stub added.

<!-- CHANGELOG_ARCHIVE_INDEX -->
See archives in /docs/changelog/.
