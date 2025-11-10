# LiquiLab State — Overview

## 1. Indexer Overview
- **Purpose:** Consolidated Flare V3 pipeline that ingests raw Ēnosys/Sparkdex NonfungiblePositionManager/pool events, enriches them, and feeds LiquiLab dashboards.
- **Mode (2025-11-09):** **Flare-only RPC** (no ANKR traffic). Middleware gate funnels all traffic to `/placeholder` until demo cookie set; `/placeholder` password is **Demo88**. Admin dashboards: `/admin/ankr` (cache-only stats) and `/admin/db` (table explorer, confirmation pending).
- **Architecture:** `CLI (backfill | follower)` → `IndexerCore` → `RpcScanner` → `Decoders (factory | pool | nfpm | state)` → `DbWriter` → Postgres (`PoolEvent`, `PositionEvent`, analytics tables). Streams still match Ēnosys/Sparkdex pools + NFPM + pool_state + position_reads.
- **Run modes:** Backfill (deterministic windows, stream-selectable) + follower tailer (12 s cadence, confirmation depth=2). Data lifecycle: raw NDJSON (180 d) → enriched JSON → Postgres (authoritative) → dashboards/APIs.
- **Routing:** Pure Pages Router (Next.js 15). Mixed App Router conflicts were resolved by removing `app/` directory and consolidating all API routes under `pages/api/`.

---

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

---

## Brand & Pricing (reference)
- Visual guardrails: water-wave 100% visible, cards background `#0B1530`, Electric Blue primary, Aqua only as accent, `tabular-nums`, spacing tokens consistent.
- Pricing defaults (Nov 6, 2025): Base $14.95/mo for 5 pools, 14-day trial. Extra pools: $9.95/mo per 5. RangeBand™ Alerts: $2.49 per pool.

---

## Product & Roadmap Docs
- `docs/product/feature-roadmap.md` — investor/team-ready roadmap tables (Portfolio, Alerts, Analytics, UX). Dark-blue layout cues, aqua highlights, RangeBand™ terminology throughout.
