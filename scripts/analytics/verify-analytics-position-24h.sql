-- scripts/analytics/verify-analytics-position-24h.sql
-- Verify analytics_position_24h MV: size, indexes, data quality
-- Created: 2025-11-06

\timing on

\echo ''
\echo '=== MV Size & Index Usage ==='
SELECT
  schemaname,
  matviewname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||matviewname)) AS data_size
FROM pg_matviews
WHERE matviewname = 'analytics_position_24h';

\echo ''
\echo '=== Indexes on analytics_position_24h ==='
SELECT
  indexname,
  indexdef,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE tablename = 'analytics_position_24h'
ORDER BY indexname;

\echo ''
\echo '=== Top 7 Days (most recent) ==='
SELECT
  day,
  pool,
  mints,
  burns,
  transfers,
  distinct_positions,
  distinct_wallets
FROM analytics_position_24h
ORDER BY day DESC, pool
LIMIT 7;

\echo ''
\echo '=== Daily Totals (last 7 days, all pools aggregated) ==='
SELECT
  day,
  SUM(mints) AS total_mints,
  SUM(burns) AS total_burns,
  SUM(transfers) AS total_transfers,
  SUM(distinct_positions) AS total_distinct_positions,
  SUM(distinct_wallets) AS total_distinct_wallets
FROM analytics_position_24h
WHERE day >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY day
ORDER BY day DESC;

\echo ''
\echo '=== Pool Coverage (count of days tracked per pool, top 10) ==='
SELECT
  pool,
  COUNT(*) AS days_tracked,
  MIN(day) AS first_day,
  MAX(day) AS last_day,
  SUM(mints) AS total_mints,
  SUM(burns) AS total_burns
FROM analytics_position_24h
GROUP BY pool
ORDER BY days_tracked DESC, total_mints DESC
LIMIT 10;

\echo ''
\echo '=== Data Quality: Unmapped Pools ==='
SELECT
  day,
  mints,
  burns,
  transfers,
  distinct_positions
FROM analytics_position_24h
WHERE pool = 'unknown'
ORDER BY day DESC
LIMIT 5;

