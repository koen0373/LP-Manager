-- mv_pool_changes_7d
-- Notable pool changes in last 7 days (new pools, TVL changes, etc.).
-- Refresh schedule: cron or /api/enrich/refresh-views.
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_pool_changes_7d" AS
WITH latest_blocks AS (
  SELECT MAX("blockNumber") AS max_block FROM "PoolEvent"
),
pool_first_seen AS (
  SELECT "pool", MIN("blockNumber") AS first_block
  FROM "PoolEvent"
  GROUP BY "pool"
)
SELECT p."pool",
       pfs.first_block,
       CASE WHEN pfs.first_block >= lb.max_block - 50400 THEN 'NEW' ELSE 'EXISTING' END AS change_type,
       COUNT(*) FILTER (WHERE p."eventName" = 'Mint') AS mints_7d,
       COUNT(*) FILTER (WHERE p."eventName" = 'Burn') AS burns_7d
FROM "PoolEvent" p
CROSS JOIN latest_blocks lb
LEFT JOIN pool_first_seen pfs ON pfs."pool" = p."pool"
WHERE p."blockNumber" >= lb.max_block - 50400 -- approx 7d
GROUP BY p."pool", pfs.first_block, lb.max_block
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_pool_changes_7d_pool_idx
  ON "mv_pool_changes_7d" ("pool");


