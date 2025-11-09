-- Materialized view for latest per-pool tick/liquidity snapshot.
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_pool_latest_state" AS
WITH ranked AS (
    SELECT
        "pool",
        "blockNumber",
        "logIndex",
        "timestamp",
        "tick",
        "liquidity",
        "sqrtPriceX96",
        ROW_NUMBER() OVER (PARTITION BY "pool" ORDER BY "blockNumber" DESC, "logIndex" DESC) AS rn
    FROM "PoolEvent"
    WHERE "eventName" IN ('Swap', 'Mint', 'Burn', 'Collect')
)
SELECT
    r."pool",
    r."blockNumber",
    r."logIndex",
    r."timestamp",
    r."tick",
    r."liquidity",
    r."sqrtPriceX96",
    to_timestamp(r."timestamp") AS updated_at
FROM ranked r
WHERE r.rn = 1
WITH NO DATA;

-- Unique index (required for CONCURRENT refresh + lookup by pool).
CREATE UNIQUE INDEX IF NOT EXISTS mv_pool_latest_state_pool_idx
    ON "mv_pool_latest_state" ("pool");
