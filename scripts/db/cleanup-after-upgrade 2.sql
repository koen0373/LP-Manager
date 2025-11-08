-- =========================================================================
-- LiquiLab Database Cleanup — Post Railway Upgrade
-- =========================================================================
-- Purpose: Free up disk space and optimize after "No space left on device"
-- Run AFTER Railway plan upgrade (Developer/Team tier with more disk)
-- =========================================================================

\set ON_ERROR_STOP on
\timing on

-- Show current database size before cleanup
\echo '=== Database Size BEFORE Cleanup ==='
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as total_size,
  (SELECT pg_size_pretty(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)))::bigint)
   FROM pg_tables WHERE schemaname = 'public') as tables_size;

\echo ''
\echo '=== Top 10 Largest Tables ==='
SELECT
  schemaname || '.' || tablename AS table_name,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size,
  pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) AS data_size,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename) - pg_relation_size(schemaname || '.' || tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
LIMIT 10;

\echo ''
\echo '=== Cleanup Step 1: VACUUM FULL (reclaim disk space) ==='
-- VACUUM FULL rewrites tables to reclaim space
-- WARNING: This will LOCK tables during operation (can take 5-15 min)
VACUUM FULL ANALYZE "PositionEvent";
VACUUM FULL ANALYZE "PositionTransfer";
VACUUM FULL ANALYZE "PoolEvent";
VACUUM FULL ANALYZE "SyncCheckpoint";

\echo ''
\echo '=== Cleanup Step 2: Drop old/unused indexes ==='
-- Check for duplicate or unused indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid::regclass)) as index_size
FROM pg_indexes
JOIN pg_stat_user_indexes USING (schemaname, tablename, indexname)
WHERE schemaname = 'public'
  AND idx_scan = 0  -- Never used
  AND pg_relation_size(indexrelid::regclass) > 1024*1024  -- > 1MB
ORDER BY pg_relation_size(indexrelid::regclass) DESC;

\echo ''
\echo '=== Cleanup Step 3: Clean old checkpoints (keep last 30 days) ==='
DELETE FROM "SyncCheckpoint"
WHERE "updatedAt" < NOW() - INTERVAL '30 days'
  AND source NOT IN ('factory', 'pools');  -- Keep factory/pools checkpoints
\echo 'Deleted old checkpoints'

\echo ''
\echo '=== Cleanup Step 4: Remove duplicate events (if any) ==='
-- Check for duplicates in PositionEvent
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "txHash", "logIndex" ORDER BY "blockNumber") as rn
  FROM "PositionEvent"
)
DELETE FROM "PositionEvent" WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
\echo 'Removed duplicate PositionEvents'

-- Check for duplicates in PositionTransfer
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "txHash", "tokenId", "blockNumber" ORDER BY "blockNumber") as rn
  FROM "PositionTransfer"
)
DELETE FROM "PositionTransfer" WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
\echo 'Removed duplicate PositionTransfers'

\echo ''
\echo '=== Cleanup Step 5: Reindex all tables ==='
REINDEX TABLE "PositionEvent";
REINDEX TABLE "PositionTransfer";
REINDEX TABLE "PoolEvent";
REINDEX TABLE "SyncCheckpoint";

\echo ''
\echo '=== Database Size AFTER Cleanup ==='
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as total_size,
  (SELECT pg_size_pretty(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)))::bigint)
   FROM pg_tables WHERE schemaname = 'public') as tables_size;

\echo ''
\echo '=== Cleanup Summary ==='
SELECT 
  'PositionEvent' as table_name,
  COUNT(*) as rows,
  COUNT(DISTINCT "tokenId") as unique_tokens,
  COUNT(CASE WHEN pool != 'unknown' THEN 1 END) as with_pool,
  pg_size_pretty(pg_total_relation_size('"PositionEvent"')) as size
FROM "PositionEvent"
UNION ALL
SELECT 
  'PositionTransfer',
  COUNT(*),
  COUNT(DISTINCT "tokenId"),
  NULL,
  pg_size_pretty(pg_total_relation_size('"PositionTransfer"'))
FROM "PositionTransfer"
UNION ALL
SELECT 
  'PoolEvent',
  COUNT(*),
  NULL,
  NULL,
  pg_size_pretty(pg_total_relation_size('"PoolEvent"'))
FROM "PoolEvent";

\echo ''
\echo '✅ Cleanup complete! Database is optimized.'
\echo '⚠️  Note: analytics_position_flat needs REFRESH after pool resolution completes.'

