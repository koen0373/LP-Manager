#!/usr/bin/env tsx
/**
 * APR Calculation Enrichment Script
 * 
 * Calculates APR (Annual Percentage Rate) for pools based on:
 * 1. Fees APR: (fees_24h / tvl) * 365 * 100
 * 2. Total APR: ((fees_24h + incentives_24h) / tvl) * 365 * 100
 * 
 * Updates Pool table with both APR values
 * 
 * Usage:
 *   npx tsx scripts/enrich-apr-calculation.ts [--limit=100] [--offset=0]
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

const limit = Number(args.get('limit') ?? 100);
const offset = Number(args.get('offset') ?? 0);

async function enrichAprCalculation() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 APR Calculation Enrichment (Fees + Incentives)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get pools with recent activity (last 24h) and active incentives (including rFLR)
  const pools = await prisma.$queryRaw<Array<{
    poolAddress: string;
    token0Symbol: string | null;
    token1Symbol: string | null;
    tvlUsd: number;
    fees24hUsd: number;
    incentives24hUsd: number;
    rflr24hUsd: number; // rFLR rewards per day (from vested calculation)
  }>>`
    WITH pool_fees_24h AS (
      SELECT
        pe."pool",
        COALESCE(SUM(
          CASE 
            WHEN pe."eventType" = 'COLLECT' 
            AND pe."metadata"->>'feesUsd' IS NOT NULL
            AND pe."timestamp" >= NOW() - INTERVAL '24 hours'
            THEN CAST(pe."metadata"->>'feesUsd' AS DECIMAL)
            ELSE 0
          END
        ), 0) as fees_24h_usd
      FROM "PositionEvent" pe
      WHERE pe."pool" != 'unknown'
        AND pe."pool" IS NOT NULL
        AND pe."timestamp" >= NOW() - INTERVAL '24 hours'
      GROUP BY pe."pool"
    ),
    pool_tvl AS (
      SELECT
        pe."pool",
        COALESCE(SUM(
          CASE 
            WHEN pe."eventType" = 'COLLECT'
            AND pe."metadata"->>'feesUsd' IS NOT NULL
            THEN CAST(pe."metadata"->>'feesUsd' AS DECIMAL)
            ELSE 0
          END
        ), 0) as tvl_usd_estimate
      FROM "PositionEvent" pe
      WHERE pe."pool" != 'unknown'
        AND pe."pool" IS NOT NULL
      GROUP BY pe."pool"
    ),
    pool_incentives_24h AS (
      SELECT
        pi."poolAddress",
        COALESCE(SUM(
          CASE 
            WHEN pi."startDate" <= NOW()
            AND (pi."endDate" IS NULL OR pi."endDate" >= NOW())
            AND pi."rewardUsdPerDay" IS NOT NULL
            THEN CAST(pi."rewardUsdPerDay" AS DECIMAL)
            ELSE 0
          END
        ), 0) as incentives_24h_usd
      FROM "PoolIncentive" pi
      WHERE pi."startDate" <= NOW()
        AND (pi."endDate" IS NULL OR pi."endDate" >= NOW())
      GROUP BY pi."poolAddress"
    ),
    pool_rflr_24h AS (
      SELECT
        pe."pool",
        -- Calculate daily rFLR rate from total rFLR / position age
        COALESCE(AVG(
          CASE 
            WHEN pe."metadata"->'rflrRewards'->>'totalRflrUsd' IS NOT NULL
            AND pe."metadata"->'rflrRewards'->>'vestingStartDate' IS NOT NULL
            THEN CAST(pe."metadata"->'rflrRewards'->>'totalRflrUsd' AS DECIMAL) / 
                 GREATEST(EXTRACT(EPOCH FROM (NOW() - CAST(pe."metadata"->'rflrRewards'->>'vestingStartDate' AS TIMESTAMP))) / 86400, 1)
            ELSE 0
          END
        ), 0) as rflr_24h_usd
      FROM "PositionEvent" pe
      WHERE pe."pool" != 'unknown'
        AND pe."pool" IS NOT NULL
        AND pe."metadata"->'rflrRewards' IS NOT NULL
      GROUP BY pe."pool"
    )
    SELECT
      p.address as "poolAddress",
      p."token0Symbol",
      p."token1Symbol",
      COALESCE(pt.tvl_usd_estimate, 0) as "tvlUsd",
      COALESCE(pf.fees_24h_usd, 0) as "fees24hUsd",
      COALESCE(pi.incentives_24h_usd, 0) as "incentives24hUsd",
      COALESCE(pr.rflr_24h_usd, 0) as "rflr24hUsd"
    FROM "Pool" p
    LEFT JOIN pool_fees_24h pf ON pf."pool" = p.address
    LEFT JOIN pool_tvl pt ON pt."pool" = p.address
    LEFT JOIN pool_incentives_24h pi ON pi."poolAddress" = p.address
    LEFT JOIN pool_rflr_24h pr ON pr."pool" = p.address
    WHERE pf.fees_24h_usd > 0
      OR pt.tvl_usd_estimate > 0
      OR pi.incentives_24h_usd > 0
      OR pr.rflr_24h_usd > 0
    ORDER BY (pf.fees_24h_usd + COALESCE(pi.incentives_24h_usd, 0) + COALESCE(pr.rflr_24h_usd, 0)) DESC NULLS LAST
    LIMIT ${limit}
    OFFSET ${offset};
  `;

  console.log(`📊 Found ${pools.length} pools to calculate APR for\n`);

  let calculated = 0;
  let updated = 0;
  let failed = 0;

  for (const pool of pools) {
    try {
      // Calculate Fees APR: (fees_24h / tvl) * 365 * 100
      // If TVL is 0 or very small, skip
      if (pool.tvlUsd < 1) {
        failed++;
        continue;
      }

      const feesApr = (pool.fees24hUsd / pool.tvlUsd) * 365 * 100;
      
      // Calculate Total APR: ((fees_24h + incentives_24h + rflr_24h) / tvl) * 365 * 100
      // Note: rFLR is vested over 12 months, so we use daily rate
      const totalApr = ((pool.fees24hUsd + pool.incentives24hUsd + pool.rflr24hUsd) / pool.tvlUsd) * 365 * 100;

      // Update Pool table with both APR values
      await prisma.$executeRaw`
        UPDATE "Pool"
        SET "metadata" = COALESCE("metadata", '{}'::jsonb) || 
          jsonb_build_object(
            'aprFees', ${feesApr},
            'aprTotal', ${totalApr},
            'aprLastUpdated', ${new Date().toISOString()},
            'fees24hUsd', ${pool.fees24hUsd},
            'incentives24hUsd', ${pool.incentives24hUsd},
            'rflr24hUsd', ${pool.rflr24hUsd},
            'tvlUsd', ${pool.tvlUsd}
          )
        WHERE address = ${pool.poolAddress};
      `;

      calculated++;
      updated++;

      if (calculated % 10 === 0) {
        console.log(`  Progress: ${calculated}/${pools.length} pools processed`);
      }
    } catch (error) {
      failed++;
      console.warn(`⚠️  Failed to calculate APR for pool ${pool.poolAddress}:`, error instanceof Error ? error.message : String(error));
    }
  }

  const avgFeesApr = pools.length > 0
    ? pools.filter(p => p.tvlUsd >= 1).reduce((sum, p) => {
        const apr = (p.fees24hUsd / p.tvlUsd) * 365 * 100;
        return sum + apr;
      }, 0) / pools.filter(p => p.tvlUsd >= 1).length
    : 0;
  
  const avgTotalApr = pools.length > 0
    ? pools.filter(p => p.tvlUsd >= 1).reduce((sum, p) => {
        const apr = ((p.fees24hUsd + p.incentives24hUsd + p.rflr24hUsd) / p.tvlUsd) * 365 * 100;
        return sum + apr;
      }, 0) / pools.filter(p => p.tvlUsd >= 1).length
    : 0;

  console.log(`\n✅ APR Calculation Complete:`);
  console.log(`   - Processed: ${calculated}`);
  console.log(`   - Updated: ${updated}`);
  console.log(`   - Failed: ${failed}`);
  console.log(`   - Average Fees APR: ${avgFeesApr.toFixed(2)}%`);
  console.log(`   - Average Total APR: ${avgTotalApr.toFixed(2)}%\n`);

  return { calculated, updated, failed, avgFeesApr, avgTotalApr };
}

async function main() {
  console.log('🚀 APR Calculation Enrichment Script');
  console.log(`📅 Started: ${new Date().toISOString()}\n`);
  console.log(`⚙️  Configuration:`);
  console.log(`   - Limit: ${limit}`);
  console.log(`   - Offset: ${offset}\n`);

  const startTime = Date.now();
  const results = await enrichAprCalculation();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ENRICHMENT SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`⏱️  Total time: ${elapsed}s\n`);
  console.log(`📊 APR Calculation:`);
  console.log(`   ✅ Calculated: ${results.calculated}`);
  console.log(`   ✅ Updated: ${results.updated}`);
  console.log(`   📈 Average Fees APR: ${results.avgFeesApr.toFixed(2)}%`);
  console.log(`   📈 Average Total APR: ${results.avgTotalApr.toFixed(2)}%`);
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

