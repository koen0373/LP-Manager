-- Provider estimate verification

-- Coverage vs total
WITH universe AS (
  SELECT COUNT(DISTINCT "tokenId") AS total_ids
  FROM (
    SELECT "tokenId" FROM "PositionTransfer"
    UNION
    SELECT "tokenId" FROM "PositionEvent"
  ) u
),
per_provider AS (
  SELECT provider, COUNT(*) AS ids
  FROM analytics_provider_estimate
  GROUP BY provider
)
SELECT
  u.total_ids,
  COALESCE(SUM(pp.ids) FILTER (WHERE pp.provider='enosys'),0)   AS enosys_ids,
  COALESCE(SUM(pp.ids) FILTER (WHERE pp.provider='sparkdex'),0) AS sparkdex_ids
FROM universe u, per_provider pp;

-- Breakdown per provider
SELECT provider, COUNT(*) AS positions
FROM analytics_provider_estimate
GROUP BY provider
ORDER BY positions DESC;

-- Optional owner drill-down if analytics_position_flat exists
DO $$
BEGIN
  IF to_regclass('analytics_position_flat') IS NOT NULL THEN
    RAISE NOTICE 'Top owners per provider (sample 10 each)';
  ELSE
    RAISE NOTICE 'analytics_position_flat missing; skip owner breakdown';
  END IF;
END$$;

WITH have_flat AS (
  SELECT to_regclass('analytics_position_flat') AS t
)
SELECT ape.provider, apf.owner_address, COUNT(*) AS positions
FROM have_flat hf
JOIN analytics_provider_estimate ape ON hf.t IS NOT NULL
JOIN analytics_position_flat apf ON apf.token_id = ape.token_id
WHERE apf.owner_address IS NOT NULL
  AND apf.owner_address <> ''
GROUP BY ape.provider, apf.owner_address
ORDER BY ape.provider, positions DESC
LIMIT 10;
