-- mv_pool_volume_7d
-- Rolling 7-day trading volume per pool (from Swap events).
-- Refresh schedule: cron or /api/enrich/refresh-views.
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_pool_volume_7d" AS
WITH latest_blocks AS (
  SELECT MAX("blockNumber") AS max_block FROM "PoolEvent"
)
SELECT p."pool",
       COUNT(*) FILTER (WHERE p."eventName" = 'Swap') AS swap_count,
       SUM(CAST(COALESCE(p."amount0", '0') AS NUMERIC)) AS volume0,
       SUM(CAST(COALESCE(p."amount1", '0') AS NUMERIC)) AS volume1
FROM "PoolEvent" p
CROSS JOIN latest_blocks lb
WHERE p."blockNumber" >= lb.max_block - 50400 -- approx 7d on Flare (7200 blocks/day * 7)
  AND p."eventName" = 'Swap'
GROUP BY p."pool"
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_pool_volume_7d_pool_idx
  ON "mv_pool_volume_7d" ("pool");


