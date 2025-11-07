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

