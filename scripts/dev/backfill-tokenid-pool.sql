-- tokenId → pool backfill
CREATE INDEX IF NOT EXISTS "PositionEvent_txHash_logIndex_idx" ON "PositionEvent"("txHash","logIndex");
CREATE INDEX IF NOT EXISTS "PositionEvent_tokenId_idx"         ON "PositionEvent"("tokenId");
CREATE INDEX IF NOT EXISTS "PositionEvent_pool_idx"            ON "PositionEvent"("pool");
CREATE INDEX IF NOT EXISTS "PoolEvent_txHash_tick_idx"         ON "PoolEvent"("txHash","tickLower","tickUpper");
CREATE INDEX IF NOT EXISTS "PoolEvent_eventName_idx"           ON "PoolEvent"("eventName");

-- Strategy A
WITH known AS (
  SELECT "tokenId", MAX("pool") AS pool
  FROM "PositionEvent"
  WHERE "pool" <> 'unknown'
  GROUP BY 1
)
UPDATE "PositionEvent" p
SET "pool" = k.pool
FROM known k
WHERE p."pool" = 'unknown' AND p."tokenId" = k."tokenId";

-- Strategy B
UPDATE "PositionEvent" p
SET "pool" = pe."pool"
FROM "PoolEvent" pe
WHERE p."pool" = 'unknown'
  AND pe."eventName" = 'Mint'
  AND p."txHash" = pe."txHash"
  AND p."tickLower" = pe."tickLower"
  AND p."tickUpper" = pe."tickUpper";

-- Strategy A′
WITH known2 AS (
  SELECT "tokenId", MAX("pool") AS pool
  FROM "PositionEvent"
  WHERE "pool" <> 'unknown'
  GROUP BY 1
)
UPDATE "PositionEvent" p
SET "pool" = k.pool
FROM known2 k
WHERE p."pool" = 'unknown' AND p."tokenId" = k."tokenId";
