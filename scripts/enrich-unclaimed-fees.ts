#!/usr/bin/env tsx
/**
 * Unclaimed Fees Tracking Enrichment Script
 * 
 * Tracks unclaimed fees per position by:
 * 1. Reading tokensOwed0/tokensOwed1 from NFPM.positions()
 * 2. Comparing with last COLLECT event
 * 3. Calculating USD value of unclaimed fees
 * 4. Storing in PositionEvent metadata
 * 
 * Usage:
 *   npx tsx scripts/enrich-unclaimed-fees.ts [--limit=100] [--offset=0]
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

const limit = Number(args.get('limit') ?? 100);
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

const NFPM = [
  { label: 'enosys', addr: process.env.ENOSYS_NFPM ? getAddress(process.env.ENOSYS_NFPM) : null },
  { label: 'sparkdex', addr: process.env.SPARKDEX_NFPM ? getAddress(process.env.SPARKDEX_NFPM) : null },
].filter((nf): nf is { label: string; addr: `0x${string}` } => nf.addr !== null);

// Token price service (lazy loaded)
let tokenPriceModule: any = null;
async function getTokenPriceModule() {
  if (!tokenPriceModule) {
    tokenPriceModule = await import('../src/services/tokenPriceService.js');
  }
  return tokenPriceModule;
}

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

async function getUnclaimedFees(tokenId: string): Promise<{
  tokensOwed0: string;
  tokensOwed1: string;
} | null> {
  try {
    for (const nf of NFPM) {
      try {
        const contract = getContract({
          address: nf.addr,
          abi: nfpmAbi,
          client,
        });
        const result = await contract.read.positions([BigInt(tokenId)]);
        return {
          tokensOwed0: result[8].toString(), // tokensOwed0
          tokensOwed1: result[9].toString(), // tokensOwed1
        };
      } catch {
        continue;
      }
    }
    return null;
  } catch (error) {
    console.warn(`[UNCLAIMED] Failed to get unclaimed fees for ${tokenId}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function enrichUnclaimedFees() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💰 Unclaimed Fees Tracking Enrichment');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get active positions with known pools
  const positions = await prisma.$queryRaw<Array<{
    tokenId: string;
    pool: string;
    token0Symbol: string | null;
    token1Symbol: string | null;
    token0Decimals: number | null;
    token1Decimals: number | null;
    lastCollectAmount0: string | null;
    lastCollectAmount1: string | null;
    lastCollectTimestamp: Date | null;
  }>>`
    WITH last_collects AS (
      SELECT DISTINCT ON (pe."tokenId")
        pe."tokenId",
        pe."amount0" as last_amount0,
        pe."amount1" as last_amount1,
        pe."timestamp" as last_timestamp
      FROM "PositionEvent" pe
      WHERE pe."eventType" = 'COLLECT'
        AND pe."pool" != 'unknown'
        AND pe."pool" IS NOT NULL
      ORDER BY pe."tokenId", pe."timestamp" DESC
    )
    SELECT DISTINCT
      pe."tokenId",
      pe."pool",
      p."token0Symbol",
      p."token1Symbol",
      p."token0Decimals",
      p."token1Decimals",
      lc.last_amount0 as "lastCollectAmount0",
      lc.last_amount1 as "lastCollectAmount1",
      lc.last_timestamp as "lastCollectTimestamp"
    FROM "PositionEvent" pe
    JOIN "Pool" p ON p.address = pe."pool"
    LEFT JOIN last_collects lc ON lc."tokenId" = pe."tokenId"
    WHERE pe."pool" != 'unknown'
      AND pe."pool" IS NOT NULL
      AND p."token0Symbol" IS NOT NULL
      AND p."token1Symbol" IS NOT NULL
    ORDER BY pe."tokenId"
    LIMIT ${limit}
    OFFSET ${offset};
  `;

  console.log(`📊 Found ${positions.length} positions to track unclaimed fees for`);
  console.log(`🔄 Processing with concurrency=${concurrency}...\n`);

  const limitFn = pLimit(concurrency);
  let processed = 0;
  let updated = 0;
  let failed = 0;
  let totalUnclaimedUsd = 0;
  const module = await getTokenPriceModule();

  await Promise.all(
    positions.map((pos) =>
      limitFn(async () => {
        try {
          // Get unclaimed fees from NFPM
          const unclaimed = await getUnclaimedFees(pos.tokenId);
          if (!unclaimed) {
            failed++;
            processed++;
            return;
          }

          // Convert to token units
          const tokensOwed0 = Number(unclaimed.tokensOwed0) / Math.pow(10, pos.token0Decimals || 18);
          const tokensOwed1 = Number(unclaimed.tokensOwed1) / Math.pow(10, pos.token1Decimals || 18);

          // Get token prices
          const price0 = await module.getTokenPriceWithFallback(pos.token0Symbol!, 1);
          const price1 = await module.getTokenPriceWithFallback(pos.token1Symbol!, 1);

          const unclaimedUsd = (tokensOwed0 * price0.price) + (tokensOwed1 * price1.price);

          // Update PositionEvent metadata
          await prisma.$executeRaw`
            UPDATE "PositionEvent"
            SET "metadata" = COALESCE("metadata", '{}'::jsonb) || 
              jsonb_build_object(
                'unclaimedFeesToken0', ${tokensOwed0.toString()},
                'unclaimedFeesToken1', ${tokensOwed1.toString()},
                'unclaimedFeesUsd', ${unclaimedUsd},
                'unclaimedFeesLastUpdated', ${new Date().toISOString()},
                'lastCollectAmount0', ${pos.lastCollectAmount0 || '0'},
                'lastCollectAmount1', ${pos.lastCollectAmount1 || '0'},
                'lastCollectTimestamp', ${pos.lastCollectTimestamp?.toISOString() || null}
              )
            WHERE "tokenId" = ${pos.tokenId}
            LIMIT 1;
          `;

          totalUnclaimedUsd += unclaimedUsd;
          updated++;
          processed++;
          if (processed % 50 === 0) {
            console.log(`  Progress: ${processed}/${positions.length} (updated=${updated}, failed=${failed}, total unclaimed=$${totalUnclaimedUsd.toFixed(2)})`);
          }
        } catch (error) {
          failed++;
          processed++;
          if (processed % 50 === 0) {
            console.warn(`⚠️  Failed tokenId ${pos.tokenId}:`, error instanceof Error ? error.message : String(error));
          }
        }
      }),
    ),
  );

  console.log(`\n✅ Unclaimed Fees Tracking Complete:`);
  console.log(`   - Processed: ${processed}`);
  console.log(`   - Updated: ${updated}`);
  console.log(`   - Failed: ${failed}`);
  console.log(`   - Total Unclaimed: $${totalUnclaimedUsd.toFixed(2)}\n`);

  return { processed, updated, failed, totalUnclaimedUsd };
}

async function main() {
  console.log('🚀 Unclaimed Fees Tracking Enrichment Script');
  console.log(`📅 Started: ${new Date().toISOString()}\n`);
  console.log(`⚙️  Configuration:`);
  console.log(`   - Limit: ${limit}`);
  console.log(`   - Offset: ${offset}`);
  console.log(`   - Concurrency: ${concurrency}\n`);

  const startTime = Date.now();
  const results = await enrichUnclaimedFees();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ENRICHMENT SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`⏱️  Total time: ${elapsed}s\n`);
  console.log(`💰 Unclaimed Fees:`);
  console.log(`   ✅ Updated: ${results.updated}`);
  console.log(`   💵 Total Unclaimed: $${results.totalUnclaimedUsd.toFixed(2)}`);
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

