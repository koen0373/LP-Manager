-- scripts/analytics/create-analytics-position-24h.sql
-- Analytics MV: daily rollup of ERC-721 position activity per pool
-- Created: 2025-11-06

DROP MATERIALIZED VIEW IF EXISTS analytics_position_24h CASCADE;

CREATE MATERIALIZED VIEW analytics_position_24h AS
WITH
  xfers AS (
    SELECT
      date_trunc('day', to_timestamp("timestamp"))::date AS day,
      lower("from") AS from_addr,
      lower("to")   AS to_addr,
      "tokenId",
      "blockNumber",
      "timestamp"
    FROM "PositionTransfer"
  ),
  pool_map AS (
    SELECT
      "tokenId",
      MAX(NULLIF("pool",'unknown')) AS pool
    FROM "PositionEvent"
    GROUP BY 1
  ),
  base AS (
    SELECT
      x.day,
      COALESCE(pm.pool,'unknown') AS pool,
      x."tokenId",
      x.from_addr,
      x.to_addr,
      x."blockNumber",
      CASE 
        WHEN x.from_addr = '0x0000000000000000000000000000000000000000' THEN 'mint'
        WHEN x.to_addr   = '0x0000000000000000000000000000000000000000' THEN 'burn'
        ELSE 'transfer'
      END AS activity_type
    FROM xfers x
    LEFT JOIN pool_map pm ON x."tokenId" = pm."tokenId"
  )
SELECT
  day,
  pool,
  COUNT(*) FILTER (WHERE activity_type = 'mint')     AS mints,
  COUNT(*) FILTER (WHERE activity_type = 'burn')     AS burns,
  COUNT(*) FILTER (WHERE activity_type = 'transfer') AS transfers,
  COUNT(DISTINCT "tokenId")   AS distinct_positions,
  COUNT(DISTINCT 
    CASE 
      WHEN from_addr != '0x0000000000000000000000000000000000000000' THEN from_addr 
    END
  ) + COUNT(DISTINCT 
    CASE 
      WHEN to_addr != '0x0000000000000000000000000000000000000000' THEN to_addr 
    END
  ) AS distinct_wallets
FROM base
GROUP BY day, pool;

COMMENT ON MATERIALIZED VIEW analytics_position_24h IS 'Daily rollup of ERC-721 position activity per pool: mints, burns, transfers, distinct positions, distinct wallets';
COMMENT ON COLUMN analytics_position_24h.day IS 'UTC date of activity';
COMMENT ON COLUMN analytics_position_24h.pool IS 'Pool address (lowercase), unknown if unmapped';
COMMENT ON COLUMN analytics_position_24h.mints IS 'Count of mints (transfers from ZERO)';
COMMENT ON COLUMN analytics_position_24h.burns IS 'Count of burns (transfers to ZERO)';
COMMENT ON COLUMN analytics_position_24h.transfers IS 'Count of transfers (excluding mints/burns)';
COMMENT ON COLUMN analytics_position_24h.distinct_positions IS 'Distinct tokenIds active that day/pool';
COMMENT ON COLUMN analytics_position_24h.distinct_wallets IS 'Distinct non-ZERO wallet addresses active that day/pool';

CREATE UNIQUE INDEX analytics_position_24h_day_pool_uniq ON analytics_position_24h(day, pool);
CREATE INDEX analytics_position_24h_pool_day_idx ON analytics_position_24h(pool, day DESC);
CREATE INDEX analytics_position_24h_day_desc_idx ON analytics_position_24h(day DESC);

COMMENT ON INDEX analytics_position_24h_day_pool_uniq IS 'Unique constraint for CONCURRENTLY refresh';
COMMENT ON INDEX analytics_position_24h_pool_day_idx IS 'Per-pool time series queries';
COMMENT ON INDEX analytics_position_24h_day_desc_idx IS 'Latest-day queries';

