#!/usr/bin/env tsx
/**
 * Pool Volume Metrics Enrichment Script
 * 
 * Calculates 24h volume per pool by:
 * 1. Scanning Swap events in PoolEvent table (last 24h)
 * 2. Aggregating volume per pool
 * 3. Calculating USD volume (via token prices)
 * 4. Updating Pool table with volume metrics
 * 
 * Usage:
 *   npx tsx scripts/enrich-pool-volume.ts [--limit=50] [--offset=0]
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

const limit = Number(args.get('limit') ?? 50);
const offset = Number(args.get('offset') ?? 0);

// Token price service (lazy loaded)
let tokenPriceModule: any = null;
async function getTokenPriceModule() {
  if (!tokenPriceModule) {
    tokenPriceModule = await import('../src/services/tokenPriceService.js');
  }
  return tokenPriceModule;
}

async function enrichPoolVolume() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Pool Volume Metrics Enrichment');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get pools with Swap events in last 24h
  const pools = await prisma.$queryRaw<Array<{
    poolAddress: string;
    token0Symbol: string | null;
    token1Symbol: string | null;
    token0Decimals: number | null;
    token1Decimals: number | null;
    totalAmount0: string;
    totalAmount1: string;
    swapCount: bigint;
  }>>`
    SELECT
      pe."pool" as "poolAddress",
      p."token0Symbol",
      p."token1Symbol",
      p."token0Decimals",
      p."token1Decimals",
      SUM(CAST(pe."amount0" AS DECIMAL)) as "totalAmount0",
      SUM(CAST(pe."amount1" AS DECIMAL)) as "totalAmount1",
      COUNT(*)::bigint as "swapCount"
    FROM "PoolEvent" pe
    JOIN "Pool" p ON p.address = pe."pool"
    WHERE pe."eventName" = 'Swap'
      AND pe."pool" != 'unknown'
      AND pe."pool" IS NOT NULL
      AND pe."timestamp" >= EXTRACT(EPOCH FROM (NOW() - INTERVAL '24 hours'))::bigint
      AND p."token0Symbol" IS NOT NULL
      AND p."token1Symbol" IS NOT NULL
    GROUP BY pe."pool", p."token0Symbol", p."token1Symbol", p."token0Decimals", p."token1Decimals"
    ORDER BY "swapCount" DESC
    LIMIT ${limit}
    OFFSET ${offset};
  `;

  console.log(`📊 Found ${pools.length} pools with Swap events in last 24h\n`);

  let processed = 0;
  let updated = 0;
  let failed = 0;
  const module = await getTokenPriceModule();

  for (const pool of pools) {
    try {
      // Convert amounts to token units
      const amount0 = Number(pool.totalAmount0) / Math.pow(10, pool.token0Decimals || 18);
      const amount1 = Number(pool.totalAmount1) / Math.pow(10, pool.token1Decimals || 18);

      // Get token prices
      const price0 = await module.getTokenPriceWithFallback(pool.token0Symbol!, 1);
      const price1 = await module.getTokenPriceWithFallback(pool.token1Symbol!, 1);

      // Calculate USD volume (use absolute values for volume)
      const volume0Usd = Math.abs(amount0) * price0.price;
      const volume1Usd = Math.abs(amount1) * price1.price;
      const totalVolumeUsd = volume0Usd + volume1Usd;

      // Update Pool table with volume metrics
      await prisma.$executeRaw`
        UPDATE "Pool"
        SET "metadata" = COALESCE("metadata", '{}'::jsonb) || 
          jsonb_build_object(
            'volume24h', jsonb_build_object(
              'volumeUsd', ${totalVolumeUsd},
              'volumeToken0', ${Math.abs(amount0)},
              'volumeToken1', ${Math.abs(amount1)},
              'swapCount', ${Number(pool.swapCount)},
              'lastUpdated', ${new Date().toISOString()}
            )
          ),
          "volume24hUsd" = ${totalVolumeUsd}
        WHERE address = ${pool.poolAddress};
      `;

      updated++;
      processed++;
      if (processed % 10 === 0) {
        console.log(`  Progress: ${processed}/${pools.length} pools processed`);
      }
    } catch (error) {
      failed++;
      processed++;
      console.warn(`⚠️  Failed to calculate volume for pool ${pool.poolAddress}:`, error instanceof Error ? error.message : String(error));
    }
  }

  const totalVolumeUsd = pools.reduce((sum, p) => {
    try {
      const amount0 = Number(p.totalAmount0) / Math.pow(10, p.token0Decimals || 18);
      const amount1 = Number(p.totalAmount1) / Math.pow(10, p.token1Decimals || 18);
      // This is approximate - actual calculation happens in loop with prices
      return sum + (Math.abs(amount0) + Math.abs(amount1));
    } catch {
      return sum;
    }
  }, 0);

  console.log(`\n✅ Pool Volume Metrics Complete:`);
  console.log(`   - Processed: ${processed}`);
  console.log(`   - Updated: ${updated}`);
  console.log(`   - Failed: ${failed}`);
  console.log(`   - Total Swaps (24h): ${pools.reduce((sum, p) => sum + Number(p.swapCount), 0)}\n`);

  return { processed, updated, failed, totalSwaps: pools.reduce((sum, p) => sum + Number(p.swapCount), 0) };
}

async function main() {
  console.log('🚀 Pool Volume Metrics Enrichment Script');
  console.log(`📅 Started: ${new Date().toISOString()}\n`);
  console.log(`⚙️  Configuration:`);
  console.log(`   - Limit: ${limit}`);
  console.log(`   - Offset: ${offset}\n`);

  const startTime = Date.now();
  const results = await enrichPoolVolume();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ENRICHMENT SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`⏱️  Total time: ${elapsed}s\n`);
  console.log(`📊 Pool Volume:`);
  console.log(`   ✅ Updated: ${results.updated}`);
  console.log(`   📈 Total Swaps (24h): ${results.totalSwaps}`);
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

