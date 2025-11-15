

---
### Changelog — 2025-11-06

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



---
### Changelog — 2025-11-07

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



---
### Changelog — 2025-11-07

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

