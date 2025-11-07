-- Backfill analytics_position from PositionEvent / PositionTransfer.
-- Idempotent upsert: safe to run repeatedly.
WITH
distinct_tokens AS (
    SELECT DISTINCT "tokenId" AS token_id FROM "PositionEvent"
    UNION
    SELECT DISTINCT "tokenId" AS token_id FROM "PositionTransfer"
),
span AS (
    SELECT
        u.token_id,
        MIN(u."blockNumber") AS first_block,
        MAX(u."blockNumber") AS last_block,
        to_timestamp(MIN(u."timestamp")) AS first_seen_at,
        to_timestamp(MAX(u."timestamp")) AS last_seen_at
    FROM (
        SELECT "tokenId" AS token_id, "blockNumber", "timestamp" FROM "PositionEvent"
        UNION ALL
        SELECT "tokenId" AS token_id, "blockNumber", "timestamp" FROM "PositionTransfer"
    ) u
    GROUP BY u.token_id
),
last_owner AS (
    SELECT
        "tokenId" AS token_id,
        "to"       AS owner_address,
        ROW_NUMBER() OVER (
            PARTITION BY "tokenId"
            ORDER BY "blockNumber" DESC, "logIndex" DESC
        ) AS rn
    FROM "PositionTransfer"
),
event_pool_counts AS (
    SELECT
        "tokenId"                             AS token_id,
        NULLIF("pool", 'unknown')             AS pool_address,
        COUNT(*)                              AS cnt
    FROM "PositionEvent"
    GROUP BY "tokenId", NULLIF("pool", 'unknown')
),
pool_mode AS (
    SELECT token_id, pool_address
    FROM (
        SELECT
            token_id,
            pool_address,
            ROW_NUMBER() OVER (
                PARTITION BY token_id
                ORDER BY cnt DESC, pool_address
            ) AS rnk
        FROM event_pool_counts
        WHERE pool_address IS NOT NULL
    ) ranked
    WHERE rnk = 1
),
mint_pool_guess AS (
    SELECT DISTINCT
        pe."tokenId" AS token_id,
        po."pool"    AS pool_address,
        ROW_NUMBER() OVER (
            PARTITION BY pe."tokenId"
            ORDER BY po."pool"
        ) AS rnk
    FROM "PositionEvent" pe
    JOIN "PoolEvent" po
      ON po."eventName" = 'Mint'
     AND po."txHash" = pe."txHash"
     AND po."tickLower" = pe."tickLower"
     AND po."tickUpper" = pe."tickUpper"
    WHERE COALESCE(pe."pool", 'unknown') = 'unknown'
      AND po."pool" IS NOT NULL
),
pool_choice AS (
    SELECT
        dt.token_id,
        COALESCE(pm.pool_address, mpg.pool_address) AS pool_address
    FROM distinct_tokens dt
    LEFT JOIN pool_mode pm
      ON pm.token_id = dt.token_id
    LEFT JOIN (
        SELECT token_id, pool_address
        FROM mint_pool_guess
        WHERE rnk = 1
    ) mpg ON mpg.token_id = dt.token_id
)
INSERT INTO analytics_position (
    token_id,
    owner_address,
    pool_address,
    nfpm_address,
    first_block,
    last_block,
    first_seen_at,
    last_seen_at
)
SELECT
    dt.token_id,
    lo.owner_address,
    pc.pool_address,
    CASE
        WHEN s.first_block IS NOT NULL AND s.first_block < 30617263
            THEN '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657'
        WHEN s.first_block IS NOT NULL
            THEN '0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da'
        ELSE NULL
    END AS nfpm_address,
    s.first_block,
    s.last_block,
    s.first_seen_at,
    s.last_seen_at
FROM distinct_tokens dt
LEFT JOIN span s ON s.token_id = dt.token_id
LEFT JOIN (
    SELECT token_id, owner_address
    FROM last_owner
    WHERE rn = 1
) lo ON lo.token_id = dt.token_id
LEFT JOIN pool_choice pc ON pc.token_id = dt.token_id
ON CONFLICT (token_id) DO UPDATE SET
    owner_address = COALESCE(EXCLUDED.owner_address, analytics_position.owner_address),
    pool_address  = COALESCE(EXCLUDED.pool_address,  analytics_position.pool_address),
    nfpm_address  = COALESCE(EXCLUDED.nfpm_address,  analytics_position.nfpm_address),
    first_block   = LEAST(analytics_position.first_block, EXCLUDED.first_block),
    last_block    = GREATEST(analytics_position.last_block, EXCLUDED.last_block),
    first_seen_at = LEAST(analytics_position.first_seen_at, EXCLUDED.first_seen_at),
    last_seen_at  = GREATEST(analytics_position.last_seen_at, EXCLUDED.last_seen_at);

-- TODO: Replace heuristic NFPM classifier with contract-address join once NFPM emitter is persisted.
