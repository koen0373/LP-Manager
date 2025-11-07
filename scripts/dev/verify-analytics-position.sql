\echo 'Analytics Position Verification'

SELECT COUNT(*) AS total_positions FROM analytics_position;

SELECT
    COUNT(*) FILTER (WHERE owner_address IS NOT NULL) AS with_owner,
    COUNT(*) FILTER (WHERE pool_address  IS NOT NULL) AS with_pool,
    COUNT(*) FILTER (WHERE nfpm_address  IS NOT NULL) AS with_nfpm
FROM analytics_position;

SELECT
    nfpm_address,
    COUNT(*) AS position_count
FROM analytics_position
GROUP BY nfpm_address
ORDER BY position_count DESC NULLS LAST
LIMIT 5;

SELECT
    owner_address,
    COUNT(*) AS position_count
FROM analytics_position
WHERE owner_address IS NOT NULL
GROUP BY owner_address
ORDER BY position_count DESC, owner_address
LIMIT 10;

SELECT
    pool_address,
    COUNT(*) AS position_count
FROM analytics_position
WHERE pool_address IS NOT NULL
GROUP BY pool_address
ORDER BY position_count DESC, pool_address
LIMIT 10;

\echo 'Exporting anomaly reports to /tmp'
\COPY (
    SELECT token_id, pool_address, nfpm_address
    FROM analytics_position
    WHERE owner_address IS NULL
) TO '/tmp/token_ids_without_owner.csv' WITH CSV HEADER;

\COPY (
    SELECT token_id, owner_address, nfpm_address
    FROM analytics_position
    WHERE pool_address IS NULL
) TO '/tmp/token_ids_without_pool.csv' WITH CSV HEADER;

\COPY (
    SELECT token_id, owner_address, pool_address, nfpm_address
    FROM analytics_position
    WHERE nfpm_address IS NOT NULL
      AND nfpm_address NOT IN (
          '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657',
          '0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da'
      )
) TO '/tmp/tokens_bad_nfpm.csv' WITH CSV HEADER;
