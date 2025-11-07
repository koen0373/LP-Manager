BEGIN;

DROP MATERIALIZED VIEW IF EXISTS analytics_position_flat;

CREATE MATERIALIZED VIEW analytics_position_flat AS
WITH
  tokens AS (
    SELECT DISTINCT "tokenId" AS token_id FROM "PositionEvent"
    UNION
    SELECT DISTINCT "tokenId" FROM "PositionTransfer"
  ),
  spans AS (
    SELECT
      t.token_id,
      MIN(p."blockNumber") AS first_block,
      MAX(p."blockNumber") AS last_block
    FROM tokens t
    LEFT JOIN (
      SELECT "tokenId","blockNumber" FROM "PositionEvent"
      UNION ALL
      SELECT "tokenId","blockNumber" FROM "PositionTransfer"
    ) p ON p."tokenId" = t.token_id
    GROUP BY t.token_id
  ),
  owner_pick AS (
    SELECT
      "tokenId",
      "to" AS owner_address,
      ROW_NUMBER() OVER (PARTITION BY "tokenId" ORDER BY "blockNumber" DESC, "logIndex" DESC) rn
    FROM "PositionTransfer"
  ),
  pool_pick AS (
    SELECT
      "tokenId",
      pool_address,
      ROW_NUMBER() OVER (
        PARTITION BY "tokenId"
        ORDER BY cnt DESC, pool_address
      ) AS rnk
    FROM (
      SELECT
        "tokenId",
        NULLIF("pool",'unknown') AS pool_address,
        COUNT(*) AS cnt
      FROM "PositionEvent"
      GROUP BY "tokenId", NULLIF("pool",'unknown')
    ) agg
    WHERE pool_address IS NOT NULL
  ),
  event_counts AS (
    SELECT
      "tokenId" AS token_id,
      COUNT(*) FILTER (WHERE "eventName" = 'Mint')   AS mint_events,
      COUNT(*) FILTER (WHERE "eventName" = 'Burn')   AS burn_events,
      COUNT(*) FILTER (WHERE "eventName" = 'Collect') AS collect_events
    FROM "PositionEvent"
    GROUP BY "tokenId"
  ),
  transfer_counts AS (
    SELECT
      "tokenId" AS token_id,
      COUNT(*) AS transfer_events
    FROM "PositionTransfer"
    GROUP BY "tokenId"
  )
SELECT
  t.token_id,
  CASE
    WHEN s.first_block IS NOT NULL AND s.first_block < 30617263
      THEN '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657'
    WHEN s.first_block IS NOT NULL
      THEN '0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da'
    ELSE NULL
  END AS nfpm_address,
  COALESCE(pp.pool_address, 'unknown') AS pool_address,
  pick.owner_address,
  s.first_block,
  s.last_block,
  COALESCE(ec.mint_events, 0)    AS mint_events,
  COALESCE(ec.burn_events, 0)    AS burn_events,
  COALESCE(ec.collect_events, 0) AS collect_events,
  COALESCE(tc.transfer_events, 0) AS transfer_events
FROM tokens t
LEFT JOIN spans s ON s.token_id = t.token_id
LEFT JOIN (
  SELECT "tokenId", owner_address
  FROM owner_pick
  WHERE rn = 1
) pick ON pick."tokenId" = t.token_id
LEFT JOIN (
  SELECT "tokenId", pool_address
  FROM pool_pick
  WHERE rnk = 1
) pp ON pp."tokenId" = t.token_id
LEFT JOIN event_counts ec ON ec.token_id = t.token_id
LEFT JOIN transfer_counts tc ON tc.token_id = t.token_id;

CREATE UNIQUE INDEX IF NOT EXISTS analytics_position_flat_token_idx ON analytics_position_flat(token_id);
CREATE INDEX IF NOT EXISTS analytics_position_flat_owner_idx ON analytics_position_flat(owner_address);
CREATE INDEX IF NOT EXISTS analytics_position_flat_pool_idx  ON analytics_position_flat(pool_address);
CREATE INDEX IF NOT EXISTS analytics_position_flat_nfpm_idx  ON analytics_position_flat(nfpm_address);

COMMIT;
