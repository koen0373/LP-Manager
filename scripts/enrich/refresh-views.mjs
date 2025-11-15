#!/usr/bin/env node

/**
 * Materialized View Refresh Orchestrator
 * 
 * Refreshes all enrichment MVs in safe order (dependencies first).
 * Logs timings and handles missing MVs gracefully.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MV_REFRESH_ORDER = [
  // Core dependencies first
  'mv_pool_latest_state',
  'mv_pool_fees_24h',
  // Dependent views
  'mv_position_range_status',
  'mv_pool_position_stats',
  'mv_position_latest_event',
  // 7d views
  'mv_pool_volume_7d',
  'mv_pool_fees_7d',
  'mv_positions_active_7d',
  'mv_wallet_lp_7d',
  'mv_pool_changes_7d',
];

async function checkMVExists(name) {
  try {
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM pg_matviews WHERE matviewname = ${name}
      ) as exists
    `;
    return result[0]?.exists ?? false;
  } catch (e) {
    return false;
  }
}

async function refreshMV(name) {
  const start = Date.now();
  try {
    await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY "${name}"`);
    const duration = Date.now() - start;
    return { success: true, duration, error: null };
  } catch (error) {
    const duration = Date.now() - start;
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const startTime = Date.now();
  const results = {};

  console.log('[refresh-views] Starting MV refresh orchestration...\n');

  for (const mvName of MV_REFRESH_ORDER) {
    const exists = await checkMVExists(mvName);
    if (!exists) {
      console.log(`[refresh-views] ⚠  ${mvName}: NOT FOUND (skipping)`);
      results[mvName] = { success: false, duration: 0, error: 'MV not found', missing: true };
      continue;
    }

    console.log(`[refresh-views] ↻  ${mvName}...`);
    const result = await refreshMV(mvName);
    results[mvName] = result;

    if (result.success) {
      console.log(`[refresh-views] ✓  ${mvName} (${result.duration}ms)`);
    } else {
      console.log(`[refresh-views] ✗  ${mvName}: ${result.error}`);
    }
  }

  const totalDuration = Date.now() - startTime;
  const successCount = Object.values(results).filter((r) => r.success).length;
  const missingCount = Object.values(results).filter((r) => r.missing).length;

  console.log(`\n[refresh-views] Complete: ${successCount}/${MV_REFRESH_ORDER.length} refreshed, ${missingCount} missing, ${totalDuration}ms total`);

  await prisma.$disconnect();
  process.exit(missingCount === MV_REFRESH_ORDER.length ? 1 : 0);
}

main().catch((error) => {
  console.error('[refresh-views] Fatal error:', error);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});


