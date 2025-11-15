-- mv_position_latest_event
-- Tracks the most recent event per positionId for quick enrichment lookups.
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_position_latest_event" AS
SELECT DISTINCT ON (pe."tokenId")
       pe."tokenId",
       pe."pool",
       pe."eventType",
       pe."blockNumber",
       pe."timestamp"
FROM "PositionEvent" pe
ORDER BY pe."tokenId", pe."blockNumber" DESC
WITH NO DATA;
