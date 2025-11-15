-- mv_positions_active_7d
-- Active positions in the last 7 days (positions with events).
-- Refresh schedule: cron or /api/enrich/refresh-views.
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_positions_active_7d" AS
WITH latest_blocks AS (
  SELECT MAX("blockNumber") AS max_block FROM "PositionEvent"
)
SELECT pe."tokenId",
       pe."pool",
       COUNT(DISTINCT pe."eventType") AS event_types_count,
       MAX(pe."blockNumber") AS last_block,
       MAX(pe."timestamp") AS last_timestamp
FROM "PositionEvent" pe
CROSS JOIN latest_blocks lb
WHERE pe."blockNumber" >= lb.max_block - 50400 -- approx 7d
GROUP BY pe."tokenId", pe."pool"
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_positions_active_7d_tokenid_idx
  ON "mv_positions_active_7d" ("tokenId");

CREATE INDEX IF NOT EXISTS mv_positions_active_7d_pool_idx
  ON "mv_positions_active_7d" ("pool");


