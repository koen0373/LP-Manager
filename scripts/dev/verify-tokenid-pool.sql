SELECT COUNT(*) AS positions_total FROM analytics_position_flat;
SELECT COUNT(*) AS with_owner      FROM analytics_position_flat WHERE owner_address IS NOT NULL AND owner_address <> '';
SELECT COUNT(*) AS with_pool       FROM analytics_position_flat WHERE pool_address  IS NOT NULL AND pool_address  <> 'unknown';
WITH fs AS (SELECT token_id, first_block FROM analytics_position_flat)
SELECT
  SUM(CASE WHEN first_block <  30617263 THEN 1 ELSE 0 END) AS enosys_range,
  SUM(CASE WHEN first_block >= 30617263 THEN 1 ELSE 0 END) AS sparkdex_range
FROM fs;
SELECT owner_address, COUNT(*) AS positions
FROM analytics_position_flat
WHERE owner_address IS NOT NULL AND owner_address <> ''
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;
