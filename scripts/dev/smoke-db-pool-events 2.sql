-- Smoke test SQL for pool-contract events
-- Usage: psql $DATABASE_URL -f scripts/dev/smoke-db-pool-events.sql

\echo '=== Pool Events Count by EventName ==='
SELECT "eventName", COUNT(*) as count
FROM "PoolEvent"
WHERE "eventName" IN ('Swap', 'Mint', 'Burn', 'Collect')
GROUP BY "eventName"
ORDER BY "eventName";

\echo ''
\echo '=== Last 20 Pool Events ==='
SELECT 
  "blockNumber",
  "pool",
  "eventName",
  "txHash",
  "logIndex",
  "owner",
  "recipient",
  "amount0",
  "amount1",
  "tickLower",
  "tickUpper",
  "tick",
  "sqrtPriceX96"
FROM "PoolEvent"
WHERE "eventName" IN ('Swap', 'Mint', 'Burn', 'Collect')
ORDER BY "blockNumber" DESC, "logIndex" DESC
LIMIT 20;

\echo ''
\echo '=== Sync Checkpoints (POOLS, FACTORY, NPM) ==='
SELECT 
  "source",
  "key",
  "lastBlock",
  "eventsCount",
  "updatedAt"
FROM "SyncCheckpoint"
WHERE "key" LIKE 'POOLS:%' OR "key" LIKE 'FACTORY:%' OR "key" = 'NPM:global'
ORDER BY "updatedAt" DESC;


