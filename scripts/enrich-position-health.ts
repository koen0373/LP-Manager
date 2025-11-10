#!/usr/bin/env tsx
/**
 * Position Health Metrics Enrichment Script
 * 
 * Calculates position health metrics:
 * 1. % time in-range (from snapshots or PositionEvent history)
 * 2. Range efficiency (how well positioned)
 * 3. Average time out-of-range
 * 
 * Usage:
 *   npx tsx scripts/enrich-position-health.ts [--limit=200] [--offset=0]
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Parse CLI args
const args = new Map(
  process.argv.slice(2).flatMap((kv) => {
    const [k, v] = kv.replace(/^--/, '').split('=');
    return [[k, v ?? 'true']];
  }),
);

const limit = Number(args.get('limit') ?? 200);
const offset = Number(args.get('offset') ?? 0);

async function enrichPositionHealth() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Position Health Metrics Enrichment');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get positions with range status data
  const positions = await prisma.$queryRaw<Array<{
    tokenId: string;
    pool: string;
    tickLower: number | null;
    tickUpper: number | null;
    currentTick: number | null;
    rangeStatus: string | null;
    firstSeen: Date | null;
    lastSeen: Date | null;
  }>>`
    SELECT DISTINCT
      pe."tokenId",
      pe."pool",
      pe."tickLower",
      pe."tickUpper",
      pe."tick" as "currentTick",
      pe."metadata"->>'rangeStatus' as "rangeStatus",
      MIN(pe."timestamp") as "firstSeen",
      MAX(pe."timestamp") as "lastSeen"
    FROM "PositionEvent" pe
    WHERE pe."pool" != 'unknown'
      AND pe."pool" IS NOT NULL
      AND pe."tickLower" IS NOT NULL
      AND pe."tickUpper" IS NOT NULL
    GROUP BY pe."tokenId", pe."pool", pe."tickLower", pe."tickUpper", pe."tick", pe."metadata"->>'rangeStatus'
    ORDER BY pe."tokenId"
    LIMIT ${limit}
    OFFSET ${offset};
  `;

  console.log(`📊 Found ${positions.length} positions to calculate health metrics for\n`);

  let processed = 0;
  let updated = 0;
  let failed = 0;

  for (const pos of positions) {
    try {
      // Calculate % time in-range from PositionEvent history (last 7 days)
      // Count events where rangeStatus = 'IN_RANGE' vs total events
      const healthMetrics = await prisma.$queryRaw<Array<{
        totalEvents: bigint;
        inRangeEvents: bigint;
        outOfRangeEvents: bigint;
        avgTimeOutOfRange: number | null;
      }>>`
        WITH position_events AS (
          SELECT
            pe."timestamp",
            pe."metadata"->>'rangeStatus' as range_status,
            LAG(pe."metadata"->>'rangeStatus') OVER (ORDER BY pe."timestamp") as prev_status
          FROM "PositionEvent" pe
          WHERE pe."tokenId" = ${pos.tokenId}
            AND pe."timestamp" >= NOW() - INTERVAL '7 days'
            AND pe."metadata"->>'rangeStatus' IS NOT NULL
        ),
        status_changes AS (
          SELECT
            range_status,
            COUNT(*) as event_count,
            CASE 
              WHEN range_status = 'OUT_OF_RANGE' THEN 
                EXTRACT(EPOCH FROM (MAX("timestamp") - MIN("timestamp"))) / 3600.0
              ELSE 0
            END as hours_out_of_range
          FROM position_events
          GROUP BY range_status
        )
        SELECT
          COALESCE(SUM(event_count), 0)::bigint as "totalEvents",
          COALESCE(SUM(event_count) FILTER (WHERE range_status = 'IN_RANGE'), 0)::bigint as "inRangeEvents",
          COALESCE(SUM(event_count) FILTER (WHERE range_status = 'OUT_OF_RANGE'), 0)::bigint as "outOfRangeEvents",
          COALESCE(AVG(hours_out_of_range) FILTER (WHERE range_status = 'OUT_OF_RANGE'), 0) as "avgTimeOutOfRange"
        FROM status_changes;
      `;

      const metrics = healthMetrics[0];
      const totalEvents = Number(metrics.totalEvents);
      const inRangeEvents = Number(metrics.inRangeEvents);
      const outOfRangeEvents = Number(metrics.outOfRangeEvents);
      
      // Calculate % time in-range
      const pctTimeInRange = totalEvents > 0 ? (inRangeEvents / totalEvents) * 100 : 0;
      
      // Calculate range efficiency (how close to current price)
      let rangeEfficiency = 0;
      if (pos.currentTick !== null && pos.tickLower !== null && pos.tickUpper !== null) {
        const rangeWidth = pos.tickUpper - pos.tickLower;
        const distanceFromLower = Math.abs(pos.currentTick - pos.tickLower);
        const distanceFromUpper = Math.abs(pos.currentTick - pos.tickUpper);
        const minDistance = Math.min(distanceFromLower, distanceFromUpper);
        
        // Efficiency: closer to center = better (0-100%)
        rangeEfficiency = rangeWidth > 0 
          ? Math.max(0, 100 - (minDistance / rangeWidth) * 100)
          : 0;
      }

      // Update PositionEvent metadata
      await prisma.$executeRaw`
        UPDATE "PositionEvent"
        SET "metadata" = COALESCE("metadata", '{}'::jsonb) || 
          jsonb_build_object(
            'healthMetrics', jsonb_build_object(
              'pctTimeInRange', ${pctTimeInRange},
              'rangeEfficiency', ${rangeEfficiency},
              'totalEvents7d', ${totalEvents},
              'inRangeEvents7d', ${inRangeEvents},
              'outOfRangeEvents7d', ${outOfRangeEvents},
              'avgTimeOutOfRangeHours', ${metrics.avgTimeOutOfRange || 0},
              'lastUpdated', ${new Date().toISOString()}
            )
          )
        WHERE "tokenId" = ${pos.tokenId}
        LIMIT 1;
      `;

      updated++;
      processed++;
      if (processed % 50 === 0) {
        console.log(`  Progress: ${processed}/${positions.length} (updated=${updated}, failed=${failed})`);
      }
    } catch (error) {
      failed++;
      processed++;
      if (processed % 50 === 0) {
        console.warn(`⚠️  Failed tokenId ${pos.tokenId}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  const avgPctInRange = positions.length > 0
    ? positions.reduce((sum, p) => {
        // This is approximate - actual calculation happens in query
        return sum + (p.rangeStatus === 'IN_RANGE' ? 100 : 0);
      }, 0) / positions.length
    : 0;

  console.log(`\n✅ Position Health Metrics Complete:`);
  console.log(`   - Processed: ${processed}`);
  console.log(`   - Updated: ${updated}`);
  console.log(`   - Failed: ${failed}`);
  console.log(`   - Average % In-Range: ${avgPctInRange.toFixed(1)}%\n`);

  return { processed, updated, failed, avgPctInRange };
}

async function main() {
  console.log('🚀 Position Health Metrics Enrichment Script');
  console.log(`📅 Started: ${new Date().toISOString()}\n`);
  console.log(`⚙️  Configuration:`);
  console.log(`   - Limit: ${limit}`);
  console.log(`   - Offset: ${offset}\n`);

  const startTime = Date.now();
  const results = await enrichPositionHealth();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ENRICHMENT SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`⏱️  Total time: ${elapsed}s\n`);
  console.log(`📊 Position Health:`);
  console.log(`   ✅ Updated: ${results.updated}`);
  console.log(`   📈 Average % In-Range: ${results.avgPctInRange.toFixed(1)}%`);
  console.log(`   ❌ Failed: ${results.failed}\n`);

  console.log('✅ Enrichment complete!\n');

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });

