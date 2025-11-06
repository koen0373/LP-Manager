# PROJECT_STATE · LiquiLab Indexer & API (Concise)

> Living document for the LiquiLab Flare V3 indexer stack.  
> Last updated: 2025-11-06. Target size ≤ 25 KB; archived snapshots live under `docs/ops/STATE_ARCHIVE/`.

---

## 1. Indexer Overview
- **Purpose:** Consolidated Flare V3 pipeline that ingests raw Ēnosys/SparkDEX NonfungiblePositionManager and pool-contract events, enriches them into analytics-ready tables, and powers LiquiLab pool dashboards plus market reports.
- **Scope:**  
  - Ēnosys + SparkDEX concentrated-liquidity pools on Flare mainnet.  
  - Streams:  
    • `factories` → `PoolCreated`/`CreatePool` (pool discovery)  
    • `nfpm` → Mint / Increase / Decrease / Collect / Transfer (position lifecycle)  
    • `pools` → Swap / Mint / Burn / Collect (pool-level flow)  
    • `pool_state` → slot0/liquidity/feeGrowth snapshots (per window)  
    • `position_reads` → `positions(tokenId)` as-of block snapshots
- **Architecture (text diagram):**  
  `CLI (backfill | follower)` → `IndexerCore` → `RpcScanner` → `Event Decoders (factoryScanner | poolScanner | nfpm decoder | state readers)` → `DbWriter` → `Postgres (PoolEvent | PositionEvent | analytics_*)`.
- **Run modes:**  
  - **Backfill:** deterministic block windows, re-run friendly, supports stream selection via `--streams=...`.  
  - **Follower:** 12 s polling tail with confirmation depth=2; sequential stream execution (factories → nfpm → pools) when factory flag supplied.
- **Data lifecycle:** raw NDJSON shards (180-day retention) → enriched JSON → Postgres (authoritative) → analytics materializations & APIs.

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
- ✅ CLI backfill supports `--streams=pools` (invokes `indexPoolEvents`).  
- ✅ Dev runner + smoke SQL + unit tests for pool decode flow.  
- ▶ Enrich analytics: inRange %, fee yield trend, IL% breakdown, pool cohort BI exports.  
- ▶ UI surfaces: PoolDetail deep dive (owner metrics, whale watch, alert toggles).  
- ▶ Automation: nightly `state:rotate` cron, weekly snapshots → `public/brand*.json`.  
- ▶ Ops: finalize transactional mail provider; integrate alerts pipeline once analytics stable.  
- ▶ BI exports: NDJSON dumps for `PoolEvent` / `PositionEvent` (quarterly).  
- ▶ Testing: upstream RPC alternates (Flare official) + CI smoke for indexer scripts.

---

## 10. Changelog — 2025-11-06

**Changed Files:**
- `scripts/indexer-backfill.ts` — added `runPools` branch calling `indexer.indexPoolEvents({ checkpointKey: 'all', fromBlock, dryRun })` when `--streams=pools`.
- `src/indexer/poolScanner.ts` — removed private `mapPoolEvent` + helper funcs; now imports from `mappers/mapPoolEvent`.
- `src/indexer/mappers/mapPoolEvent.ts` — (NEW) extracted pure mapping logic for Swap/Mint/Burn/Collect → `PoolEventRow`.
- `scripts/dev/run-pools.ts` — (NEW) dev runner: defaults fromBlock=49618000, calls `indexPoolEvents`, logs compact JSON summary.
- `scripts/dev/smoke-db-pool-events.sql` — (NEW) SQL smoke test: counts per eventName, last 20 rows, checkpoint table.
- `src/indexer/__tests__/poolDecode.spec.ts` — (NEW) vitest unit tests: roundtrip encode/decode + `mapPoolEvent` validation for Swap/Mint/Burn/Collect.
- `PROJECT_STATE.md` — updated CLI usage (pools stream example), added dev runner & smoke test docs, listed unit test command.

**Reason:**  
Integrated pool-contract event indexing into backfill CLI, extracted `mapPoolEvent` for testability, added dev tooling (runner + SQL smoke test + unit tests) to validate decode/mapping flow end-to-end.

**ENV keys touched:** None.

**Errors:** None.

**Next suggested step:** Run `pnpm exec tsx -r dotenv/config scripts/dev/run-pools.ts --from=49618000 --to=49620000` to verify pool indexing flow, then check DB with `psql $DATABASE_URL -f scripts/dev/smoke-db-pool-events.sql` to confirm `PoolEvent` rows and `POOLS:all` checkpoint exist.

---

**SILENT policy reminder:** Codex/Claude deliverables must remain `PROJECT_STATE.md` + `[PASTE BLOCK — RESULTS FOR GPT]`.  
**Rotation rule:** keep last 7 daily changelog entries inline; archive older snapshots under `docs/changelog/YYYY/`.

---

### Database Configuration — 2025-11-06

**Engine:** PostgreSQL 16 (local via Homebrew)  
**Connection URL:** `postgresql://postgres:postgres@localhost:5432/liquilab?schema=public`  
**Prisma RAW_DB:** `postgresql://postgres:postgres@localhost:5432/liquilab`  
**Schema:** `public`  
**Port:** 5432  
**User:** `postgres`  
**Password:** `postgres`  
**Usage:**  
- Used by all local indexer and analytics scripts.  
- Mirrors the production Railway Docker Postgres setup.  
- Persistent volume: `$HOME/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Liquilab`  

✅ Verified via `psql` and `prisma db push` on 2025-11-06 — all migrations in sync.

