-- mv_pool_position_stats
-- Aggregated stats per pool (positions count, avg width, etc.).
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_pool_position_stats" AS
SELECT pe."pool",
       COUNT(DISTINCT pe."tokenId") AS position_count,
       AVG(COALESCE(pe."tickUpper", 0) - COALESCE(pe."tickLower", 0)) AS avg_range,
       MAX(pe."blockNumber") AS last_block
FROM "PositionEvent" pe
GROUP BY pe."pool"
WITH NO DATA;
