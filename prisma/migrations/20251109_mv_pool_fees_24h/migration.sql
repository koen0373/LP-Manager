-- Materialized view for 24h pool fee aggregates (Collect events).
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_pool_fees_24h" AS
SELECT
    "pool",
    SUM(COALESCE(NULLIF("amount0", ''),'0')::numeric) AS fees_token0,
    SUM(COALESCE(NULLIF("amount1", ''),'0')::numeric) AS fees_token1,
    NULL::numeric AS fees_24h_usd,
    NOW() AS updated_at
FROM "PoolEvent"
WHERE "eventName" = 'Collect'
  AND to_timestamp("timestamp") >= NOW() - INTERVAL '24 hours'
GROUP BY "pool"
WITH NO DATA;

-- Unique index to support CONCURRENT refresh + quick lookup by pool.
CREATE UNIQUE INDEX IF NOT EXISTS mv_pool_fees_24h_pool_idx
    ON "mv_pool_fees_24h" ("pool");
