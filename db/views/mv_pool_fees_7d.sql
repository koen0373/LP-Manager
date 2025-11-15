-- mv_pool_fees_7d
-- Rolling 7-day fee aggregates per pool (from Collect events).
-- Refresh schedule: cron or /api/enrich/refresh-views.
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_pool_fees_7d" AS
WITH latest_blocks AS (
  SELECT MAX("blockNumber") AS max_block FROM "PoolEvent"
)
SELECT p."pool",
       SUM(CAST(COALESCE(p."amount0", '0') AS NUMERIC)) AS fees0,
       SUM(CAST(COALESCE(p."amount1", '0') AS NUMERIC)) AS fees1
FROM "PoolEvent" p
CROSS JOIN latest_blocks lb
WHERE p."blockNumber" >= lb.max_block - 50400 -- approx 7d on Flare
  AND p."eventName" = 'Collect'
GROUP BY p."pool"
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_pool_fees_7d_pool_idx
  ON "mv_pool_fees_7d" ("pool");


