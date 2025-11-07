-- scripts/analytics/refresh-analytics-position-24h.sql
-- Refresh the 24h rollup MV and show recent activity
-- Created: 2025-11-06

\timing on

REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_position_24h;

\echo ''
\echo '=== Last 7 Days Activity (by day, pool) ==='
SELECT
  day,
  pool,
  mints,
  burns,
  transfers,
  distinct_positions,
  distinct_wallets
FROM analytics_position_24h
WHERE day >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY day DESC, pool;

