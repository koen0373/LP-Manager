# LiquiLab State — Open Actions

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
