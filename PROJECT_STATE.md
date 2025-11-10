# PROJECT_STATE · LiquiLab Indexer & API (Snapshot)

> Live snapshot for the LiquiLab Flare V3 stack. Deep references now live under `docs/state/*`. Target size <300 lines.

---

## Overview — snapshot
- Flare-only ingestion pipeline (IndexerCore + RpcScanner + DbWriter) is healthy; follower cadence 12s with depth=2 and autoslow on 429s.
- Next.js 15 Pages Router app runs on Railway (`next start -p $PORT`); middleware keeps `/placeholder` gated until demo cookie is set.
- Postgres remains the source of truth (`PoolEvent`, `PositionEvent`, analytics_* views) with raw NDJSON retained 180d and enrichment scripts feeding hourly stats.
- Admin tooling: `/admin/enrichment`, `/admin/ankr`, `/admin/db` (verification pending) plus cron endpoints (`/api/cron/enrichment-hourly`).
- State docs rotation landed (ADR-0001): architecture, hosting, backlog, and history now live under `docs/state/*` while this file stays short.

## Quick links
- `docs/state/README.md` — layout + editing workflow
- `docs/state/overview.md` — architecture, analytics, testing
- `docs/state/stack_hosting.md` — env vars, runbooks, hosting rules
- `docs/state/directory.md` — repo map + state editing flow
- `docs/state/known_issues.md` — active limitations
- `docs/state/open_actions.md` — backlog beyond the top 10
- `docs/state/decisions/ADR-0001.md` — modular state docs decision
- `docs/state/incidents/_TEMPLATE.md` — incident write-up starter
- `docs/state/changelog/2025-11.md` — archived entries (>14d)

## Open actions — top 10
- [P1] Verify `/admin/db` returns table list & rows in production (app router implementation live but pending confirmation).
- [P1] Re-run ERC-721 backfill with wider cursor (start ≤25,000,000) and confirm NFPM addresses + transfers emitted.
- [P2] Kick short pools-indexer scan and confirm `data/indexer.progress.json` is created/updated.
- [P3] Add health row on `/admin/ankr` exposing last cron execution result.
- [ ] Persist NFPM emitter address into PositionEvent/PositionTransfer and re-classify without heuristic.
- [ ] Improve pool matching for positions with `pool_address IS NULL` (txHash+ticks join & NFPM read).
- [ ] Add materiali
zed view `analytics_pool_24h` once position table is stable.
- [ ] Run ANKR nightly validation job (sampled PositionTransfer owners vs ANKR responses).
- [ ] Design enrichment job to fill unknown pools/owners via ANKR Advanced API.
- [ ] Document pricing/cache retention strategy for ANKR-sourced token data.

## Changelog — 2025-11-10

### Indexer resilience + RPC safety
- Added per-contract try/catch in `src/indexer/indexerCore.ts` to stop single NFPM scan failures from crashing the full run; logged failures continue to the next address.
- `scripts/indexer-follower.ts` + `scripts/dev/run-pools.ts` docs updated in `docs/state/stack_hosting.md` to reflect autoslow/backoff defaults.

### Enrichment dashboards + APIs
- `pages/api/admin/enrichment-stats.ts` slimmed to 281 lines with sane logging, 30s timeout, and DISTINCT ON SQL; `/admin/enrichment` surfaced range-status metrics.
- SQL helpers `scripts/enrich-unclaimed-fees.ts` and `scripts/enrich-impermanent-loss.ts` now use `DISTINCT ON` instead of `QUALIFY` for Postgres compatibility.
- `pages/api/cron/enrichment-hourly.ts` orchestrates 10 enrichment scripts (pool attribution, fees, range status, snapshots, APR, IL, rFLR vesting, unclaimed fees, position health, pool volume).

### Range/health instrumentation
- New scripts shipped: `scripts/enrich-range-status.ts`, `scripts/enrich-position-snapshots.ts`, `scripts/enrich-apr-calculation.ts`, `scripts/enrich-position-health.ts`, `scripts/enrich-pool-volume.ts`, and `scripts/enrich-rflr-vesting.ts` (see `/admin/enrichment` quick actions).
- Added `/pages/api/admin/indexer-stats.ts` + `/pages/admin/enrichment-stats.ts` references in docs to keep dashboard parity documented.

### Pricing & token telemetry
- Token pricing flow rebuilt around CoinGecko-backed `src/services/tokenPriceService.ts` with 5‑minute caching and 40+ token coverage; pricing helpers in `lib/pricing.ts` and `/api/public/pricing` now consume the cache.
- `config/token_registry.json` + `config/brand_pools.csv` refreshed to include pools surfaced via GeckoTerminal + DexScreener research (see docs/market/overview/* references in IDE tabs).

### Ops & documentation
- Introduced `docs/state/*` layout (overview, stack_hosting, directory, actions, known issues, ADR template, incident template, changelog index) replacing the 1,100‑line monolith.
- Added `scripts/state/rotate_project_state.mjs` plus npm scripts `state:rotate` and `state:check` to enforce the rotation window and <300 line target; README documents the workflow.
- Created ADR-0001 for modular state docs and refreshed `docs/state/open_actions.md` + `docs/state/known_issues.md`.

#### Changed files
- `docs/state/README.md` — New index describing the state layout + editing rules.
- `docs/state/overview.md` — Houses architecture, analytics, testing, and brand references.
- `docs/state/stack_hosting.md` — Captures environment variables, config defaults, runbooks.
- `docs/state/directory.md` — Summarizes repo layout + state editing workflow.
- `docs/state/known_issues.md` — Lists active limitations and tracking guidance.
- `docs/state/open_actions.md` — Stores the full backlog beyond the top 10 snapshot.
- `docs/state/decisions/_TEMPLATE.md` — ADR template for future decisions.
- `docs/state/decisions/ADR-0001.md` — Records the modular state docs decision.
- `docs/state/incidents/_TEMPLATE.md` — Incident write-up template.
- `docs/state/changelog/2025-11.md` — Archive file for rotated November entries.
- `docs/state/changelog/2025-10.md` — Placeholder archive for future October rotations.
- `scripts/state/rotate_project_state.mjs` — Automation for changelog/archive rotation.
- `package.json` — Adds `state:rotate` / `state:check` npm scripts.
- `README.md` — Documents the new Project State layout & workflow.
- `PROJECT_STATE.md` — Rewritten snapshot with overview, quick links, open actions, and today’s changelog.

---

> Rotation: run `npm run state:rotate` (or `npm run state:check`) before merging to archive older changelog entries and keep the snapshot lean.

<!-- CHANGELOG_ARCHIVE_INDEX -->
See archives in /docs/changelog/.
