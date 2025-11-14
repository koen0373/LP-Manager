-- mv_wallet_lp_7d
-- LP wallet activity summary for last 7 days.
-- Refresh schedule: cron or /api/enrich/refresh-views.
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_wallet_lp_7d" AS
WITH latest_blocks AS (
  SELECT MAX("blockNumber") AS max_block FROM "PositionEvent"
)
SELECT pe."owner" AS wallet,
       COUNT(DISTINCT pe."tokenId") AS positions_count,
       COUNT(DISTINCT pe."pool") AS pools_count,
       SUM(CAST(COALESCE(pe."amount0", '0') AS NUMERIC)) AS total_amount0,
       SUM(CAST(COALESCE(pe."amount1", '0') AS NUMERIC)) AS total_amount1
FROM "PositionEvent" pe
CROSS JOIN latest_blocks lb
WHERE pe."blockNumber" >= lb.max_block - 50400 -- approx 7d
  AND pe."owner" IS NOT NULL
GROUP BY pe."owner"
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_wallet_lp_7d_wallet_idx
  ON "mv_wallet_lp_7d" ("wallet");


