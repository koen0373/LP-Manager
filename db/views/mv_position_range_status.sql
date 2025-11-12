-- mv_position_range_status
-- Provides precomputed in-range/out-of-range markers for LP positions.
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_position_range_status" AS
SELECT pe."tokenId",
       pe."pool",
       pe."tickLower",
       pe."tickUpper",
       ps."current_tick",
       CASE
         WHEN ps."current_tick" BETWEEN pe."tickLower" AND pe."tickUpper" THEN 'IN_RANGE'
         ELSE 'OUT_OF_RANGE'
       END AS range_status
FROM "PositionEvent" pe
JOIN "PoolStateSnapshot" ps ON ps."pool" = pe."pool"
WITH NO DATA;
