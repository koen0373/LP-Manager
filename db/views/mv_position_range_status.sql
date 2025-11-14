-- mv_position_range_status
-- Provides precomputed in-range/out-of-range markers for LP positions.
-- Uses mv_pool_latest_state for current tick lookup.
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_position_range_status" AS
SELECT DISTINCT ON (pe."tokenId")
       pe."tokenId",
       pe."pool",
       pe."tickLower",
       pe."tickUpper",
       (SELECT "tick" FROM "mv_pool_latest_state" WHERE "pool" = pe."pool" LIMIT 1) as current_tick,
       CASE
         WHEN pe."tickLower" IS NOT NULL 
           AND pe."tickUpper" IS NOT NULL 
           AND EXISTS (SELECT 1 FROM "mv_pool_latest_state" WHERE "pool" = pe."pool" AND "tick" IS NOT NULL)
           AND (SELECT "tick" FROM "mv_pool_latest_state" WHERE "pool" = pe."pool" LIMIT 1) >= pe."tickLower" 
           AND (SELECT "tick" FROM "mv_pool_latest_state" WHERE "pool" = pe."pool" LIMIT 1) < pe."tickUpper"
         THEN 'IN_RANGE'
         WHEN pe."tickLower" IS NOT NULL 
           AND pe."tickUpper" IS NOT NULL 
           AND EXISTS (SELECT 1 FROM "mv_pool_latest_state" WHERE "pool" = pe."pool" AND "tick" IS NOT NULL)
         THEN 'OUT_OF_RANGE'
         ELSE NULL
       END AS range_status
FROM "PositionEvent" pe
WHERE pe."tickLower" IS NOT NULL 
  AND pe."tickUpper" IS NOT NULL
ORDER BY pe."tokenId", pe."blockNumber" DESC, pe."logIndex" DESC
WITH NO DATA;
