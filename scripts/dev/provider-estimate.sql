-- Provider estimate via first seen block (no indexer changes required)
BEGIN;

-- 1) Helper: first seen block per tokenId
WITH u AS (
  SELECT "tokenId","blockNumber" FROM "PositionTransfer"
  UNION ALL
  SELECT "tokenId","blockNumber" FROM "PositionEvent"
),
first_seen AS (
  SELECT "tokenId", MIN("blockNumber") AS first_block
  FROM u
  GROUP BY 1
)
-- 2) Drop old view if exists
DROP MATERIALIZED VIEW IF EXISTS analytics_provider_estimate;

-- 3) Create fresh MV
CREATE MATERIALIZED VIEW analytics_provider_estimate AS
SELECT
  fs."tokenId"::text        AS token_id,
  fs.first_block::integer   AS first_block,
  CASE WHEN fs.first_block < 30617263 THEN 'enosys' ELSE 'sparkdex' END::text AS provider
FROM first_seen fs;

-- 4) Indexes
CREATE UNIQUE INDEX IF NOT EXISTS analytics_provider_estimate_token_id_udx
  ON analytics_provider_estimate (token_id);

CREATE INDEX IF NOT EXISTS analytics_provider_estimate_provider_idx
  ON analytics_provider_estimate (provider);

COMMIT;

-- Refresh helper (idempotent): run as needed
-- REFRESH MATERIALIZED VIEW analytics_provider_estimate;

-- Notes:
-- * This is a heuristic split using Sparkdex start block (≈ 30,617,263).
-- * Once NFPM address is stored per Transfer/Event, switch classification to contract address for perfect accuracy.
