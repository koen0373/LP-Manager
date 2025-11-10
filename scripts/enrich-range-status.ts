#!/usr/bin/env tsx
/**
 * Range Status Enrichment Script
 * 
 * Calculates IN_RANGE/OUT_OF_RANGE status for positions by:
 * 1. Reading position data from NFPM (tickLower, tickUpper)
 * 2. Reading pool current tick from slot0
 * 3. Calculating range status
 * 4. Storing in analytics_position_snapshot or updating PositionEvent
 * 
 * Usage:
 *   npx tsx scripts/enrich-range-status.ts [--limit=1000] [--offset=0]
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getAddress } from 'viem';
import { createPublicClient, http, parseAbi, getContract } from 'viem';
import { flare } from '../src/lib/chainFlare';

const prisma = new PrismaClient();

// Parse CLI args
const args = new Map(
  process.argv.slice(2).flatMap((kv) => {
    const [k, v] = kv.replace(/^--/, '').split('=');
    return [[k, v ?? 'true']];
  }),
);

const limit = Number(args.get('limit') ?? 1000);
const offset = Number(args.get('offset') ?? 0);
const concurrency = Math.min(Number(args.get('concurrency') ?? 10), 12);

// RPC client
const RPC_URL = process.env.FLARE_RPC_URL || process.env.FLARE_RPC_URLS?.split(',')[0] || 'https://flare-api.flare.network/ext/bc/C/rpc';
const client = createPublicClient({
  chain: flare,
  transport: http(RPC_URL),
});

// ABIs
const nfpmAbi = parseAbi([
  'function positions(uint256 tokenId) view returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)',
]);

const poolAbi = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
]);

const NFPM = [
  { label: 'enosys', addr: process.env.ENOSYS_NFPM ? getAddress(process.env.ENOSYS_NFPM) : null },
  { label: 'sparkdex', addr: process.env.SPARKDEX_NFPM ? getAddress(process.env.SPARKDEX_NFPM) : null },
].filter((nf): nf is { label: string; addr: `0x${string}` } => nf.addr !== null);

// Concurrency limiter
function pLimit(n: number) {
  const queue: Array<() => void> = [];
  let activeCount = 0;
  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      const fn = queue.shift();
      if (fn) fn();
    }
  };
  return function <T>(fn: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        activeCount++;
        fn()
          .then((value) => {
            resolve(value);
            next();
          })
          .catch((error) => {
            reject(error);
            next();
          });
      };
      if (activeCount < n) run();
      else queue.push(run);
    });
  };
}

async function getPositionTicks(tokenId: string): Promise<{ tickLower: number; tickUpper: number } | null> {
  for (const nf of NFPM) {
    try {
      const contract = getContract({
        address: nf.addr,
        abi: nfpmAbi,
        client,
      });
      const result = await contract.read.positions([BigInt(tokenId)]);
      const tickLower = Number(result[5]);
      const tickUpper = Number(result[6]);
      return { tickLower, tickUpper };
    } catch {
      continue;
    }
  }
  return null;
}

async function getPoolCurrentTick(poolAddress: string): Promise<number | null> {
  try {
    const pool = getAddress(poolAddress);
    const contract = getContract({
      address: pool,
      abi: poolAbi,
      client,
    });
    const slot0 = await contract.read.slot0();
    return Number(slot0[1]); // tick is second element
  } catch (error) {
    console.warn(`[RANGE] Failed to get tick for pool ${poolAddress}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

function calculateRangeStatus(tick: number, tickLower: number, tickUpper: number): 'IN_RANGE' | 'OUT_OF_RANGE' {
  return tick >= tickLower && tick <= tickUpper ? 'IN_RANGE' : 'OUT_OF_RANGE';
}

async function enrichRangeStatus() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Range Status Enrichment');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get unique positions with known pools
  const positions = await prisma.$queryRaw<Array<{
    tokenId: string;
    pool: string;
  }>>`
    SELECT DISTINCT 
      pt."tokenId",
      pe."pool"
    FROM "PositionTransfer" pt
    JOIN "PositionEvent" pe ON pe."tokenId" = pt."tokenId"
    WHERE pe."pool" != 'unknown'
      AND pe."pool" IS NOT NULL
      AND pt."to" != '0x0000000000000000000000000000000000000000'
    ORDER BY pt."tokenId"
    LIMIT ${limit}
    OFFSET ${offset};
  `;

  console.log(`📊 Found ${positions.length} positions to process`);
  console.log(`🔄 Processing with concurrency=${concurrency}...\n`);

  const limitFn = pLimit(concurrency);
  let processed = 0;
  let calculated = 0;
  let failed = 0;
  const rangeStatusMap = new Map<string, { status: 'IN_RANGE' | 'OUT_OF_RANGE'; tick: number; tickLower: number; tickUpper: number }>();

  // First pass: get position ticks and pool ticks
  await Promise.all(
    positions.map((pos) =>
      limitFn(async () => {
        try {
          // Get position ticks from NFPM
          const positionTicks = await getPositionTicks(pos.tokenId);
          if (!positionTicks) {
            failed++;
            processed++;
            return;
          }

          // Get pool current tick
          const currentTick = await getPoolCurrentTick(pos.pool);
          if (currentTick === null) {
            failed++;
            processed++;
            return;
          }

          const status = calculateRangeStatus(currentTick, positionTicks.tickLower, positionTicks.tickUpper);
          rangeStatusMap.set(pos.tokenId, {
            status,
            tick: currentTick,
            tickLower: positionTicks.tickLower,
            tickUpper: positionTicks.tickUpper,
          });

          calculated++;
          processed++;
          if (processed % 100 === 0) {
            console.log(`  Progress: ${processed}/${positions.length} (calculated=${calculated}, failed=${failed})`);
          }
        } catch (error) {
          failed++;
          processed++;
          if (processed % 100 === 0) {
            console.warn(`⚠️  Failed tokenId ${pos.tokenId}:`, error instanceof Error ? error.message : String(error));
          }
        }
      }),
    ),
  );

  // Second pass: update PositionEvent with range status
  console.log(`\n🔄 Updating PositionEvent records with range status...`);
  let updated = 0;

  for (const [tokenId, rangeData] of rangeStatusMap.entries()) {
    try {
      await prisma.$executeRaw`
        UPDATE "PositionEvent"
        SET 
          "tickLower" = ${rangeData.tickLower},
          "tickUpper" = ${rangeData.tickUpper},
          "tick" = ${rangeData.tick},
          "metadata" = COALESCE("metadata", '{}'::jsonb) || jsonb_build_object('rangeStatus', ${rangeData.status})
        WHERE "tokenId" = ${tokenId}
          AND ("tickLower" IS NULL OR "tickUpper" IS NULL OR "tick" IS NULL);
      `;
      updated++;
    } catch (error) {
      console.warn(`⚠️  Failed to update tokenId ${tokenId}:`, error instanceof Error ? error.message : String(error));
    }
  }

  const inRange = Array.from(rangeStatusMap.values()).filter(r => r.status === 'IN_RANGE').length;
  const outOfRange = Array.from(rangeStatusMap.values()).filter(r => r.status === 'OUT_OF_RANGE').length;

  console.log(`\n✅ Range Status Enrichment Complete:`);
  console.log(`   - Processed: ${processed}`);
  console.log(`   - Calculated: ${calculated}`);
  console.log(`   - Failed: ${failed}`);
  console.log(`   - Updated: ${updated}`);
  console.log(`   - IN_RANGE: ${inRange}`);
  console.log(`   - OUT_OF_RANGE: ${outOfRange}\n`);

  return { processed, calculated, failed, updated, inRange, outOfRange };
}

async function main() {
  console.log('🚀 Range Status Enrichment Script');
  console.log(`📅 Started: ${new Date().toISOString()}\n`);
  console.log(`⚙️  Configuration:`);
  console.log(`   - Limit: ${limit}`);
  console.log(`   - Offset: ${offset}`);
  console.log(`   - Concurrency: ${concurrency}\n`);

  const startTime = Date.now();
  const results = await enrichRangeStatus();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ENRICHMENT SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`⏱️  Total time: ${elapsed}s\n`);
  console.log(`📋 Range Status:`);
  console.log(`   ✅ Calculated: ${results.calculated}`);
  console.log(`   ✅ Updated: ${results.updated}`);
  console.log(`   📊 IN_RANGE: ${results.inRange}`);
  console.log(`   📊 OUT_OF_RANGE: ${results.outOfRange}`);
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

