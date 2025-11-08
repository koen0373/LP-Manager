-- Creates or refreshes the analytics_position_flat materialized view.
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_position_flat AS
WITH
  last_transfer AS (
    SELECT tokenId,
           "to" AS owner_address,
           ROW_NUMBER() OVER (PARTITION BY tokenId ORDER BY blockNumber DESC, logIndex DESC) rn
    FROM "PositionTransfer"
  ),
  pool_pick AS (
    SELECT tokenId,
           MIN(pool) FILTER (WHERE pool IS NOT NULL AND pool <> 'unknown') AS pool_address
    FROM "PositionEvent"
    GROUP BY tokenId
  ),
  bounds AS (
    SELECT tokenId,
           MIN(blockNumber) AS first_block,
           MAX(blockNumber) AS last_block
    FROM (
      SELECT tokenId, blockNumber FROM "PositionEvent"
      UNION ALL
      SELECT tokenId, blockNumber FROM "PositionTransfer"
    ) u
    GROUP BY tokenId
  )
SELECT
  b.tokenId                                  AS token_id,
  lt.owner_address                           AS owner_address,
  COALESCE(pp.pool_address, 'unknown')       AS pool_address,
  b.first_block,
  b.last_block
FROM bounds b
LEFT JOIN (SELECT tokenId, owner_address FROM last_transfer WHERE rn=1) lt USING (tokenId)
LEFT JOIN pool_pick pp USING (tokenId);

CREATE UNIQUE INDEX IF NOT EXISTS analytics_position_flat_token_id_idx ON analytics_position_flat(token_id);
CREATE INDEX IF NOT EXISTS analytics_position_flat_owner_idx ON analytics_position_flat(owner_address);
CREATE INDEX IF NOT EXISTS analytics_position_flat_pool_idx  ON analytics_position_flat(pool_address);
