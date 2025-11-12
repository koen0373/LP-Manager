-- mv_pool_latest_state
-- Materialized view stub documenting the latest known block per pool.
-- Refresh handled externally (see scripts/README). Safe to run multiple times.
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_pool_latest_state" AS
SELECT "pool" AS pool,
       MAX("blockNumber") AS "blockNumber"
FROM "PoolEvent"
GROUP BY "pool"
WITH NO DATA;
