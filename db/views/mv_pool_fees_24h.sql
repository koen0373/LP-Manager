-- mv_pool_fees_24h
-- Captures rolling 24h fee stats per pool. Refresh schedule: cron or /api/enrich/refresh-views.
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_pool_fees_24h" AS
WITH latest_blocks AS (
  SELECT MAX("blockNumber") AS max_block FROM "PoolEvent"
)
SELECT p."pool",
       SUM(COALESCE(p."amount0", '0')) AS "amount0",
       SUM(COALESCE(p."amount1", '0')) AS "amount1"
FROM "PoolEvent" p
CROSS JOIN latest_blocks lb
WHERE p."blockNumber" >= lb.max_block - 7200 -- approx 24h on Flare
GROUP BY p."pool"
WITH NO DATA;
