#!/usr/bin/env tsx
/**
 * Data Enrichment Pipeline for User Engagement Reports
 * 
 * Combines:
 * 1. Pool attribution backfill (fix pool='unknown')
 * 2. Fees USD calculation (add usdValue to COLLECT events)
 * 
 * Usage:
 *   npm run enrich:data [--limit=1000] [--offset=0] [--skip-pool] [--skip-fees]
 *   tsx scripts/enrich-user-engagement-data.ts --limit=1000 --offset=0
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
const skipPool = args.has('skip-pool');
const skipFees = args.has('skip-fees');

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

const factoryAbi = parseAbi([
  'function getPool(address tokenA,address tokenB,uint24 fee) view returns (address)',
]);

const NFPM = [
  { label: 'enosys', addr: process.env.ENOSYS_NFPM ? getAddress(process.env.ENOSYS_NFPM) : null },
  { label: 'sparkdex', addr: process.env.SPARKDEX_NFPM ? getAddress(process.env.SPARKDEX_NFPM) : null },
].filter((nf): nf is { label: string; addr: `0x${string}` } => nf.addr !== null);

const FACTORIES = [
  process.env.ENOSYS_V3_FACTORY ? getAddress(process.env.ENOSYS_V3_FACTORY) : null,
  process.env.SPARKDEX_V3_FACTORY ? getAddress(process.env.SPARKDEX_V3_FACTORY) : null,
].filter((f): f is `0x${string}` => f !== null);

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

// Token price service (lazy loaded)
let tokenPriceModule: any = null;
async function getTokenPriceModule() {
  if (!tokenPriceModule) {
    tokenPriceModule = await import('../src/services/tokenPriceService.js');
  }
  return tokenPriceModule;
}

async function getTokenPriceWithFallback(symbol: string, fallback: number): Promise<{ price: number; source: string }> {
  try {
    const module = await getTokenPriceModule();
    return await module.getTokenPriceWithFallback(symbol, fallback);
  } catch (error) {
    console.warn(`⚠️  Could not get price for ${symbol}, using fallback`);
    return { price: fallback, source: 'fallback' };
  }
}

// Rate limiter for CoinGecko API (50 calls/min for free tier)
class RateLimiter {
  private queue: Array<() => void> = [];
  private calls: number[] = [];
  private readonly maxCallsPerMinute: number;
  private readonly delayBetweenCalls: number;

  constructor(maxCallsPerMinute: number = 50, delayBetweenCalls: number = 1200) {
    this.maxCallsPerMinute = maxCallsPerMinute;
    this.delayBetweenCalls = delayBetweenCalls; // 1200ms = ~50 calls/min
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    // Remove calls older than 1 minute
    this.calls = this.calls.filter(timestamp => now - timestamp < 60000);

    // If we're at the limit, wait
    if (this.calls.length >= this.maxCallsPerMinute) {
      const oldestCall = this.calls[0];
      const waitTime = 60000 - (now - oldestCall) + 100; // Add 100ms buffer
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // Add delay between calls
    await new Promise(resolve => setTimeout(resolve, this.delayBetweenCalls));
    this.calls.push(Date.now());
  }
}

const rateLimiter = new RateLimiter(50, 1200); // 50 calls/min, 1200ms delay

async function resolvePoolFromNFPM(tokenId: string): Promise<string | null> {
  for (const nf of NFPM) {
    try {
      const contract = getContract({
        address: nf.addr,
        abi: nfpmAbi,
        client,
      });
      const result = await contract.read.positions([BigInt(tokenId)]);
      const token0 = result[2];
      const token1 = result[3];
      const fee = Number(result[4]);
      
      for (const factory of FACTORIES) {
        try {
          const facContract = getContract({
            address: factory,
            abi: factoryAbi,
            client,
          });
          const pool = await facContract.read.getPool([token0, token1, fee]);
          if (pool && pool !== '0x0000000000000000000000000000000000000000') {
            return pool.toLowerCase();
          }
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function enrichPoolAttribution() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 STEP 1: Pool Attribution Backfill');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const unknownPositions = await prisma.$queryRaw<Array<{ tokenId: string }>>`
    SELECT DISTINCT "tokenId"
    FROM "PositionEvent"
    WHERE "pool" = 'unknown'
    ORDER BY "tokenId"
    LIMIT ${limit}
    OFFSET ${offset};
  `;

  console.log(`📊 Found ${unknownPositions.length} positions with pool="unknown"`);
  console.log(`🔄 Processing with concurrency=${concurrency}...\n`);

  const limitFn = pLimit(concurrency);
  let processed = 0;
  let resolved = 0;
  let skipped = 0;

  await Promise.all(
    unknownPositions.map((pos) =>
      limitFn(async () => {
        const pool = await resolvePoolFromNFPM(pos.tokenId);
        if (pool) {
          await prisma.$executeRaw`
            UPDATE "PositionEvent"
            SET "pool" = ${pool}
            WHERE "tokenId" = ${pos.tokenId}
              AND "pool" = 'unknown';
          `;
          resolved++;
        } else {
          skipped++;
        }
        processed++;
        if (processed % 100 === 0) {
          console.log(`  Progress: ${processed}/${unknownPositions.length} (resolved=${resolved}, skipped=${skipped})`);
        }
      }),
    ),
  );

  const remaining = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM "PositionEvent" WHERE "pool" = 'unknown';
  `;

  console.log(`\n✅ Pool Attribution Complete:`);
  console.log(`   - Processed: ${processed}`);
  console.log(`   - Resolved: ${resolved}`);
  console.log(`   - Skipped: ${skipped}`);
  console.log(`   - Remaining unknown: ${remaining[0].count}\n`);

  return { processed, resolved, skipped, remaining: Number(remaining[0].count) };
}

async function calculateFeesUsd(
  amount0: string,
  amount1: string,
  token0Symbol: string,
  token1Symbol: string,
  token0Decimals: number,
  token1Decimals: number,
  priceMap: Record<string, number>
): Promise<number> {
  try {
    // Use pre-fetched prices from batch
    const price0 = priceMap[token0Symbol] ?? 1;
    const price1 = priceMap[token1Symbol] ?? 1;

    const amount0Num = Number(amount0) / Math.pow(10, token0Decimals);
    const amount1Num = Number(amount1) / Math.pow(10, token1Decimals);

    return (amount0Num * price0) + (amount1Num * price1);
  } catch (error) {
    console.warn(`[FEES] Failed for ${token0Symbol}/${token1Symbol}:`, error instanceof Error ? error.message : String(error));
    return 0;
  }
}

async function enrichFeesUsd() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 STEP 2: Fees USD Calculation (Optimized)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Fetch events with pool info in one query
  const collectEvents = await prisma.$queryRaw<Array<{
    id: string;
    pool: string;
    amount0: string;
    amount1: string;
    token0Symbol: string | null;
    token1Symbol: string | null;
    token0Decimals: number | null;
    token1Decimals: number | null;
  }>>`
    SELECT 
      pe.id,
      pe."pool",
      pe."amount0",
      pe."amount1",
      p."token0Symbol",
      p."token1Symbol",
      p."token0Decimals",
      p."token1Decimals"
    FROM "PositionEvent" pe
    JOIN "Pool" p ON p.address = pe."pool"
    WHERE pe."eventType" = 'COLLECT'
      AND pe."pool" != 'unknown'
      AND pe."usdValue" IS NULL
      AND pe."amount0" IS NOT NULL
      AND pe."amount1" IS NOT NULL
    ORDER BY pe."timestamp" DESC
    LIMIT ${limit * 10};
  `;

  console.log(`📊 Found ${collectEvents.length} COLLECT events without USD value`);

  // Collect all unique tokens
  const uniqueTokens = new Set<string>();
  for (const event of collectEvents) {
    if (event.token0Symbol) uniqueTokens.add(event.token0Symbol);
    if (event.token1Symbol) uniqueTokens.add(event.token1Symbol);
  }

  console.log(`🔍 Found ${uniqueTokens.size} unique tokens`);
  console.log(`🔄 Fetching prices in batches (with rate limiting)...\n`);

  // Fetch prices in batches (max 50 tokens per batch for CoinGecko)
  const tokenArray = Array.from(uniqueTokens);
  const batchSize = 50;
  const priceMap: Record<string, number> = {};
  const module = await getTokenPriceModule();

  for (let i = 0; i < tokenArray.length; i += batchSize) {
    const batch = tokenArray.slice(i, i + batchSize);
    
    // Rate limiting: wait before each batch call
    await rateLimiter.waitForSlot();
    
    try {
      const batchPrices = await module.getTokenPricesBatch(batch);
      Object.assign(priceMap, batchPrices);
      
      // For tokens not found in batch, use fallback
      for (const token of batch) {
        if (!priceMap[token]) {
          const fallback = await getTokenPriceWithFallback(token, 1);
          priceMap[token] = fallback.price;
        }
      }
      
      console.log(`  Fetched prices for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tokenArray.length / batchSize)} (${Object.keys(priceMap).length}/${uniqueTokens.size} tokens)`);
    } catch (error) {
      console.warn(`⚠️  Batch fetch failed, using fallbacks:`, error instanceof Error ? error.message : String(error));
      // Fallback to individual calls for this batch
      for (const token of batch) {
        if (!priceMap[token]) {
          await rateLimiter.waitForSlot();
          const fallback = await getTokenPriceWithFallback(token, 1);
          priceMap[token] = fallback.price;
        }
      }
    }
  }

  console.log(`✅ Price fetching complete. Calculating USD values...\n`);

  let calculated = 0;
  let failed = 0;

  // Process events with pre-fetched prices
  for (let i = 0; i < collectEvents.length; i++) {
    const event = collectEvents[i];
    
    try {
      if (event.token0Symbol && event.token1Symbol && event.token0Decimals !== null && event.token1Decimals !== null) {
        const feesUsd = await calculateFeesUsd(
          event.amount0,
          event.amount1,
          event.token0Symbol,
          event.token1Symbol,
          event.token0Decimals,
          event.token1Decimals,
          priceMap
        );

        // Store USD value even if 0 (to mark as processed)
        await prisma.positionEvent.update({
          where: { id: event.id },
          data: { usdValue: feesUsd },
        });
        
        if (feesUsd > 0) {
          calculated++;
        } else {
          // Events with 0 fees are still processed successfully
          calculated++;
        }
      } else {
        failed++;
      }

      if ((i + 1) % 100 === 0) {
        console.log(`  Progress: ${i + 1}/${collectEvents.length} (calculated=${calculated}, failed=${failed})`);
      }
    } catch (error) {
      failed++;
      if (i % 100 === 0) {
        console.warn(`⚠️  Failed event ${event.id}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  console.log(`\n✅ Fees USD Calculation Complete:`);
  console.log(`   - Calculated: ${calculated}`);
  console.log(`   - Failed: ${failed}`);
  console.log(`   - Success rate: ${collectEvents.length > 0 ? ((calculated / collectEvents.length) * 100).toFixed(1) : 0}%`);
  console.log(`   - API calls saved: ~${collectEvents.length * 2 - Math.ceil(uniqueTokens.size / batchSize)} (batch optimization)\n`);

  return { calculated, failed };
}

async function main() {
  console.log('🚀 Data Enrichment Pipeline for User Engagement Reports');
  console.log(`📅 Started: ${new Date().toISOString()}\n`);
  console.log(`⚙️  Configuration:`);
  console.log(`   - Limit: ${limit}`);
  console.log(`   - Offset: ${offset}`);
  console.log(`   - Concurrency: ${concurrency}`);
  console.log(`   - Skip Pool: ${skipPool}`);
  console.log(`   - Skip Fees: ${skipFees}\n`);

  const startTime = Date.now();
  const results = {
    poolAttribution: { processed: 0, resolved: 0, skipped: 0, remaining: 0 },
    feesUsd: { calculated: 0, failed: 0 },
  };

  // Step 1: Pool Attribution
  if (!skipPool) {
    results.poolAttribution = await enrichPoolAttribution();
  } else {
    console.log('⏭️  Skipping pool attribution (--skip-pool)\n');
  }

  // Step 2: Fees USD Calculation
  if (!skipFees) {
    results.feesUsd = await enrichFeesUsd();
  } else {
    console.log('⏭️  Skipping fees USD calculation (--skip-fees)\n');
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ENRICHMENT SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`⏱️  Total time: ${elapsed}s\n`);
  
  if (!skipPool) {
    console.log(`📋 Pool Attribution:`);
    console.log(`   ✅ Resolved: ${results.poolAttribution.resolved}`);
    console.log(`   ⏭️  Skipped: ${results.poolAttribution.skipped}`);
    console.log(`   📊 Remaining unknown: ${results.poolAttribution.remaining}\n`);
  }
  
  if (!skipFees) {
    console.log(`💰 Fees USD Calculation:`);
    console.log(`   ✅ Calculated: ${results.feesUsd.calculated}`);
    console.log(`   ❌ Failed: ${results.feesUsd.failed}\n`);
  }

  console.log('✅ Enrichment pipeline complete!\n');

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
