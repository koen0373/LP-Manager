

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

