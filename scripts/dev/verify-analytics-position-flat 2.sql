-- Counts
SELECT COUNT(*) AS positions_total FROM analytics_position_flat;
SELECT COUNT(*) AS with_owner      FROM analytics_position_flat WHERE owner_address IS NOT NULL AND owner_address <> '';
SELECT COUNT(*) AS with_pool       FROM analytics_position_flat WHERE pool_address  IS NOT NULL AND pool_address  <> 'unknown';

-- Top owners
SELECT owner_address, COUNT(*) AS positions
FROM analytics_position_flat
WHERE owner_address IS NOT NULL AND owner_address <> ''
GROUP BY 1
ORDER BY 2 DESC
LIMIT 10;

-- Optional: export paths (caller handles COPY to files)
