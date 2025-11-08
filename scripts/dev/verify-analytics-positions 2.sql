SELECT COUNT(*) AS positions_total FROM analytics_position_flat;
SELECT COUNT(*) AS with_owner FROM analytics_position_flat WHERE owner_address IS NOT NULL AND owner_address <> '';
SELECT COUNT(*) AS with_pool FROM analytics_position_flat WHERE pool_address IS NOT NULL AND pool_address <> 'unknown';

SELECT nfpm_address, COUNT(*) AS positions
FROM analytics_position_flat
GROUP BY nfpm_address
ORDER BY positions DESC NULLS LAST
LIMIT 5;

SELECT owner_address, COUNT(*) AS positions
FROM analytics_position_flat
WHERE owner_address IS NOT NULL AND owner_address <> ''
GROUP BY owner_address
ORDER BY positions DESC, owner_address
LIMIT 10;

SELECT pool_address, COUNT(*) AS positions
FROM analytics_position_flat
WHERE pool_address IS NOT NULL AND pool_address <> 'unknown'
GROUP BY pool_address
ORDER BY positions DESC, pool_address
LIMIT 10;
