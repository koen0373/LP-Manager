DROP MATERIALIZED VIEW IF EXISTS analytics_position_flat;
CREATE MATERIALIZED VIEW analytics_position_flat AS
WITH
last_owner AS (
  SELECT DISTINCT ON ("tokenId")
         "tokenId", LOWER("to") AS owner_address, "blockNumber" AS owner_block
  FROM "PositionTransfer"
  ORDER BY "tokenId", "blockNumber" DESC, "logIndex" DESC
),
pool_map AS (
  SELECT DISTINCT ON (pe."tokenId")
         pe."tokenId", pe."pool" AS pool_address, pe."blockNumber" AS pool_block
  FROM "PositionEvent" pe
  WHERE pe."pool" <> 'unknown'
  ORDER BY pe."tokenId", pe."blockNumber" DESC, pe."logIndex" DESC
),
first_last AS (
  WITH u AS (
    SELECT "tokenId","blockNumber" FROM "PositionEvent"
    UNION ALL
    SELECT "tokenId","blockNumber" FROM "PositionTransfer"
  )
  SELECT "tokenId", MIN("blockNumber") AS first_block, MAX("blockNumber") AS last_block
  FROM u GROUP BY 1
)
SELECT
  fl."tokenId"      AS token_id,
  lo.owner_address  AS owner_address,
  COALESCE(pm.pool_address, 'unknown') AS pool_address,
  fl.first_block,
  fl.last_block
FROM first_last fl
LEFT JOIN last_owner lo ON lo."tokenId" = fl."tokenId"
LEFT JOIN pool_map  pm ON pm."tokenId" = fl."tokenId";
CREATE UNIQUE INDEX IF NOT EXISTS analytics_position_flat_token_id_uq ON analytics_position_flat(token_id);
CREATE INDEX        IF NOT EXISTS analytics_position_flat_owner_idx   ON analytics_position_flat(owner_address);
CREATE INDEX        IF NOT EXISTS analytics_position_flat_pool_idx    ON analytics_position_flat(pool_address);
