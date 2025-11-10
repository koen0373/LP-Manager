-- Materialized views for simple enrichment calculations
-- These replace complex scripts with fast database queries

-- First, ensure existing views are populated (if they exist)
DO $$
BEGIN
  -- Refresh existing views if they exist
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_pool_latest_state') THEN
    REFRESH MATERIALIZED VIEW "mv_pool_latest_state";
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_pool_fees_24h') THEN
    REFRESH MATERIALIZED VIEW "mv_pool_fees_24h";
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Views might not exist yet, continue anyway
    RAISE NOTICE 'Some existing views could not be refreshed, continuing...';
END $$;

-- 1. Range Status View
-- Calculates IN_RANGE/OUT_OF_RANGE status by comparing position ticks with pool current tick
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_position_range_status" AS
SELECT DISTINCT ON (pe."tokenId")
  pe."tokenId",
  pe."pool",
  pe."tickLower",
  pe."tickUpper",
  COALESCE(p."tick", NULL) as current_tick,
  CASE 
    WHEN pe."tickLower" IS NOT NULL 
      AND pe."tickUpper" IS NOT NULL 
      AND p."tick" IS NOT NULL
      AND p."tick" >= pe."tickLower" 
      AND p."tick" < pe."tickUpper"
    THEN 'IN_RANGE'
    WHEN pe."tickLower" IS NOT NULL 
      AND pe."tickUpper" IS NOT NULL 
      AND p."tick" IS NOT NULL
    THEN 'OUT_OF_RANGE'
    ELSE NULL
  END as range_status,
  NOW() as updated_at
FROM "PositionEvent" pe
LEFT JOIN LATERAL (
  SELECT "tick" FROM "mv_pool_latest_state" 
  WHERE "pool" = pe."pool" 
  LIMIT 1
) p ON true
WHERE pe."tickLower" IS NOT NULL 
  AND pe."tickUpper" IS NOT NULL
ORDER BY pe."tokenId", pe."blockNumber" DESC, pe."logIndex" DESC
WITH NO DATA;

-- Index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS mv_position_range_status_tokenid_idx
  ON "mv_position_range_status" ("tokenId");

CREATE INDEX IF NOT EXISTS mv_position_range_status_pool_idx
  ON "mv_position_range_status" ("pool");

CREATE INDEX IF NOT EXISTS mv_position_range_status_status_idx
  ON "mv_position_range_status" ("range_status");

-- 2. Position Statistics View
-- Aggregates position counts and statistics per pool
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_pool_position_stats" AS
SELECT 
  pe."pool",
  COUNT(DISTINCT pe."tokenId") as total_positions,
  COUNT(DISTINCT CASE WHEN pe."eventType" = 'MINT' THEN pe."tokenId" END) as active_positions,
  COUNT(DISTINCT CASE WHEN pe."eventType" = 'BURN' THEN pe."tokenId" END) as closed_positions,
  MIN(pe."blockNumber") as first_block,
  MAX(pe."blockNumber") as last_block,
  MAX(pe."timestamp") as last_activity,
  NOW() as updated_at
FROM "PositionEvent" pe
WHERE pe."pool" != 'unknown' AND pe."pool" IS NOT NULL
GROUP BY pe."pool"
WITH NO DATA;

-- Index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS mv_pool_position_stats_pool_idx
  ON "mv_pool_position_stats" ("pool");

-- 3. Position Event Summary View
-- Latest event per position for quick status checks
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_position_latest_event" AS
SELECT DISTINCT ON (pe."tokenId")
  pe."tokenId",
  pe."pool",
  pe."eventType",
  pe."blockNumber",
  pe."timestamp",
  pe."amount0",
  pe."amount1",
  pe."tickLower",
  pe."tickUpper",
  pe."tick",
  pe."usdValue",
  pe."metadata",
  NOW() as updated_at
FROM "PositionEvent" pe
WHERE pe."pool" != 'unknown' AND pe."pool" IS NOT NULL
ORDER BY pe."tokenId", pe."blockNumber" DESC, pe."logIndex" DESC
WITH NO DATA;

-- Index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS mv_position_latest_event_tokenid_idx
  ON "mv_position_latest_event" ("tokenId");

CREATE INDEX IF NOT EXISTS mv_position_latest_event_pool_idx
  ON "mv_position_latest_event" ("pool");

-- Initial data load (only refresh if views can be populated)
DO $$
BEGIN
  -- Check if mv_pool_latest_state exists and has data before refreshing range status
  IF EXISTS (
    SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_pool_latest_state'
  ) THEN
    BEGIN
      REFRESH MATERIALIZED VIEW "mv_position_range_status";
      RAISE NOTICE 'Refreshed mv_position_range_status';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not refresh mv_position_range_status (will be populated on next cron run)';
    END;
  END IF;
  
  -- These views don't depend on other views, so always refresh
  BEGIN
    REFRESH MATERIALIZED VIEW "mv_pool_position_stats";
    REFRESH MATERIALIZED VIEW "mv_position_latest_event";
    RAISE NOTICE 'Refreshed mv_pool_position_stats and mv_position_latest_event';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not refresh some views (will be populated on next cron run)';
  END;
END $$;

