# Observability: Adapters & ETL

## Dashboards
- Adapter Health: requests by status, latency p50/p95, cache hits, staleSeconds gauge.
- ETL Throughput: rows/hour per table, lag vs schedule, backfill progress.
- Error Budget: 7-day rolling error rate vs 0.5% budget.

## Alerts (examples)
- adapter_error_rate > 1% for 10m
- etl_lag_minutes > 120 (market snapshots)
- stale_seconds > TTL*3 (any market)
