#!/usr/bin/env tsx
/**
 * Impermanent Loss (IL) Calculation Enrichment Script
 * 
 * Calculates Impermanent Loss for V3 positions by:
 * 1. Reading initial deposit amounts (from first MINT event)
 * 2. Calculating current position value (from current tick and range)
 * 3. Calculating HODL value (what tokens would be worth if just held)
 * 4. IL = (current_value - hodl_value) / hodl_value * 100
 * 
 * For V3 concentrated liquidity:
 * - If currentTick < tickLower: position is 100% token0
 * - If currentTick > tickUpper: position is 100% token1
 * - If tickLower <= currentTick < tickUpper: position has both tokens (ratio depends on tick)
 * 
 * Usage:
 *   npx tsx scripts/enrich-impermanent-loss.ts [--limit=200] [--offset=0]
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

const limit = Number(args.get('limit') ?? 200);
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

/**
 * Calculate tick to price ratio
 * For Uniswap V3: price = 1.0001^tick
 */
function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

/**
 * Calculate sqrt price from tick
 * sqrtPrice = sqrt(1.0001^tick)
 */
function tickToSqrtPrice(tick: number): number {
  return Math.sqrt(tickToPrice(tick));
}

/**
 * Calculate current position amounts based on tick range and liquidity
 * Uses Uniswap V3 concentrated liquidity formulas
 * Returns { amount0, amount1 } in token units (scaled by decimals)
 */
function calculatePositionAmounts(
  tickLower: number,
  tickUpper: number,
  currentTick: number,
  liquidity: bigint,
): { amount0: number; amount1: number } {
  const sqrtPriceLower = tickToSqrtPrice(tickLower);
  const sqrtPriceUpper = tickToSqrtPrice(tickUpper);
  const sqrtPriceCurrent = tickToSqrtPrice(currentTick);
  
  // Convert liquidity from Q128.128 to number
  const liq = Number(liquidity) / Math.pow(2, 128);
  
  let amount0 = 0;
  let amount1 = 0;
  
  if (currentTick < tickLower) {
    // Position is entirely token0 (price below range)
    // amount0 = L * (1/sqrt(P_lower) - 1/sqrt(P_upper))
    amount0 = liq * ((1 / sqrtPriceLower) - (1 / sqrtPriceUpper));
    amount1 = 0;
  } else if (currentTick >= tickUpper) {
    // Position is entirely token1 (price above range)
    // amount1 = L * (sqrt(P_upper) - sqrt(P_lower))
    amount0 = 0;
    amount1 = liq * (sqrtPriceUpper - sqrtPriceLower);
  } else {
    // Position has both tokens (price within range)
    // amount0 = L * (1/sqrt(P_current) - 1/sqrt(P_upper))
    // amount1 = L * (sqrt(P_current) - sqrt(P_lower))
    amount0 = liq * ((1 / sqrtPriceCurrent) - (1 / sqrtPriceUpper));
    amount1 = liq * (sqrtPriceCurrent - sqrtPriceLower);
  }
  
  return { amount0, amount1 };
}

/**
 * Calculate Impermanent Loss with Incentives
 * IL = (current_value + incentives_value - hodl_value) / hodl_value * 100
 * 
 * Incentives reduce IL impact (they compensate for losses)
 */
function calculateIL(
  initialAmount0: number,
  initialAmount1: number,
  currentAmount0: number,
  currentAmount1: number,
  price0Initial: number,
  price1Initial: number,
  price0Current: number,
  price1Current: number,
  incentivesUsd: number = 0,
): number {
  // Current position value
  const currentValue = (currentAmount0 * price0Current) + (currentAmount1 * price1Current);
  
  // HODL value (what tokens would be worth if just held)
  const hodlValue = (initialAmount0 * price0Current) + (initialAmount1 * price1Current);
  
  if (hodlValue === 0) return 0;
  
  // IL with incentives: (current_value + incentives - hodl_value) / hodl_value * 100
  // Incentives reduce IL (negative IL becomes less negative)
  const il = ((currentValue + incentivesUsd - hodlValue) / hodlValue) * 100;
  
  return il;
}

async function getPositionData(tokenId: string, poolAddress: string): Promise<{
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  liquidity: bigint;
  amount0: number;
  amount1: number;
} | null> {
  try {
    // Get position from NFPM
    let positionData: any = null;
    for (const nf of NFPM) {
      try {
        const contract = getContract({
          address: nf.addr,
          abi: nfpmAbi,
          client,
        });
        const result = await contract.read.positions([BigInt(tokenId)]);
        positionData = {
          tickLower: Number(result[5]),
          tickUpper: Number(result[6]),
          liquidity: result[7], // liquidity
          tokensOwed0: result[8],
          tokensOwed1: result[9],
        };
        break;
      } catch {
        continue;
      }
    }

    if (!positionData) return null;

    // Get pool current tick
    const pool = getAddress(poolAddress);
    const poolContract = getContract({
      address: pool,
      abi: poolAbi,
      client,
    });
    const slot0 = await poolContract.read.slot0();
    const currentTick = Number(slot0[1]);

    // Calculate current position amounts
    const amounts = calculatePositionAmounts(
      positionData.tickLower,
      positionData.tickUpper,
      currentTick,
      positionData.liquidity,
    );

    return {
      tickLower: positionData.tickLower,
      tickUpper: positionData.tickUpper,
      currentTick,
      liquidity: positionData.liquidity,
      amount0: amounts.amount0,
      amount1: amounts.amount1,
    };
  } catch (error) {
    console.warn(`[IL] Failed to get position data for ${tokenId}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function enrichImpermanentLoss() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Impermanent Loss (IL) Calculation Enrichment');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get positions with initial MINT events, current range status, and active incentives (including rFLR vesting)
  const positions = await prisma.$queryRaw<Array<{
    tokenId: string;
    pool: string;
    token0Symbol: string | null;
    token1Symbol: string | null;
    token0Decimals: number | null;
    token1Decimals: number | null;
    initialAmount0: string;
    initialAmount1: string;
    initialTimestamp: Date;
    tickLower: number | null;
    tickUpper: number | null;
    incentivesUsd: number;
    rflrVestedUsd: number; // rFLR vested amount (not total, because it's vested)
  }>>`
    WITH initial_mints AS (
      SELECT DISTINCT ON (pe."tokenId")
        pe."tokenId",
        pe."pool",
        pe."amount0" as initial_amount0,
        pe."amount1" as initial_amount1,
        pe."timestamp" as initial_timestamp
      FROM "PositionEvent" pe
      WHERE pe."eventType" = 'MINT'
        AND pe."pool" != 'unknown'
        AND pe."pool" IS NOT NULL
      ORDER BY pe."tokenId", pe."timestamp" ASC
    ),
    position_incentives AS (
      SELECT
        pe."tokenId",
        COALESCE(SUM(
          CASE 
            WHEN pi."startDate" <= NOW()
            AND (pi."endDate" IS NULL OR pi."endDate" >= NOW())
            AND pi."rewardUsdPerDay" IS NOT NULL
            THEN CAST(pi."rewardUsdPerDay" AS DECIMAL)
            ELSE 0
          END
        ), 0) as incentives_usd_per_day
      FROM "PositionEvent" pe
      JOIN "PoolIncentive" pi ON pi."poolAddress" = pe."pool"
      WHERE pe."pool" != 'unknown'
        AND pe."pool" IS NOT NULL
      GROUP BY pe."tokenId"
    ),
    rflr_vested AS (
      SELECT
        pe."tokenId",
        COALESCE(CAST(pe."metadata"->'rflrRewards'->>'vestedRflrUsd' AS DECIMAL), 0) as rflr_vested_usd
      FROM "PositionEvent" pe
      WHERE pe."metadata"->'rflrRewards' IS NOT NULL
    )
    SELECT DISTINCT
      im."tokenId",
      im."pool",
      p."token0Symbol",
      p."token1Symbol",
      p."token0Decimals",
      p."token1Decimals",
      im.initial_amount0 as "initialAmount0",
      im.initial_amount1 as "initialAmount1",
      im.initial_timestamp as "initialTimestamp",
      pe."tickLower",
      pe."tickUpper",
      COALESCE(pi.incentives_usd_per_day, 0) as "incentivesUsd",
      COALESCE(rv.rflr_vested_usd, 0) as "rflrVestedUsd"
    FROM initial_mints im
    JOIN "Pool" p ON p.address = im."pool"
    LEFT JOIN "PositionEvent" pe ON pe."tokenId" = im."tokenId"
      AND pe."tickLower" IS NOT NULL
      AND pe."tickUpper" IS NOT NULL
    LEFT JOIN position_incentives pi ON pi."tokenId" = im."tokenId"
    LEFT JOIN rflr_vested rv ON rv."tokenId" = im."tokenId"
    WHERE p."token0Symbol" IS NOT NULL
      AND p."token1Symbol" IS NOT NULL
      AND im.initial_amount0 IS NOT NULL
      AND im.initial_amount1 IS NOT NULL
    ORDER BY im."tokenId"
    LIMIT ${limit}
    OFFSET ${offset};
  `;

  console.log(`📊 Found ${positions.length} positions to calculate IL for`);
  console.log(`🔄 Processing with concurrency=${concurrency}...\n`);

  const limitFn = pLimit(concurrency);
  let processed = 0;
  let calculated = 0;
  let failed = 0;
  const module = await getTokenPriceModule();

  // Get initial prices (from initial timestamp or use current prices as approximation)
  // For now, we'll use current prices as approximation (could be improved with historical price data)
  const ilResults: Array<{
    tokenId: string;
    il: number;
    currentValue: number;
    hodlValue: number;
  }> = [];

  await Promise.all(
    positions.map((pos) =>
      limitFn(async () => {
        try {
          // Get current position data
          const positionData = await getPositionData(pos.tokenId, pos.pool);
          if (!positionData) {
            failed++;
            processed++;
            return;
          }

          // Convert initial amounts to token units
          const initialAmount0 = Number(pos.initialAmount0) / Math.pow(10, pos.token0Decimals || 18);
          const initialAmount1 = Number(pos.initialAmount1) / Math.pow(10, pos.token1Decimals || 18);

          // Get current token prices
          const price0Current = await module.getTokenPriceWithFallback(pos.token0Symbol!, 1);
          const price1Current = await module.getTokenPriceWithFallback(pos.token1Symbol!, 1);

          // For initial prices, use current prices as approximation
          // (In production, you'd fetch historical prices from initialTimestamp)
          const price0Initial = price0Current.price;
          const price1Initial = price1Current.price;

          // Calculate IL with incentives (including rFLR vested amount)
          // Use vested rFLR, not total, because that's what's actually available
          const totalIncentivesUsd = pos.incentivesUsd + pos.rflrVestedUsd;
          
          const il = calculateIL(
            initialAmount0,
            initialAmount1,
            positionData.amount0,
            positionData.amount1,
            price0Initial,
            price1Initial,
            price0Current.price,
            price1Current.price,
            totalIncentivesUsd, // Include all incentives (pool + rFLR vested)
          );

          const currentValue = (positionData.amount0 * price0Current.price) + (positionData.amount1 * price1Current.price);
          const hodlValue = (initialAmount0 * price0Current.price) + (initialAmount1 * price1Current.price);

          // Update PositionEvent metadata with IL data (including incentives)
          await prisma.$executeRaw`
            UPDATE "PositionEvent"
            SET "metadata" = COALESCE("metadata", '{}'::jsonb) || 
              jsonb_build_object(
                'impermanentLoss', ${il},
                'ilLastUpdated', ${new Date().toISOString()},
                'currentValueUsd', ${currentValue},
                'hodlValueUsd', ${hodlValue},
                'incentivesUsd', ${pos.incentivesUsd},
                'rflrVestedUsd', ${pos.rflrVestedUsd},
                'totalIncentivesUsd', ${totalIncentivesUsd},
                'currentAmount0', ${positionData.amount0.toString()},
                'currentAmount1', ${positionData.amount1.toString()}
              )
            WHERE "tokenId" = ${pos.tokenId}
              AND "eventType" = 'MINT'
              AND "timestamp" = ${pos.initialTimestamp}
            LIMIT 1;
          `;

          ilResults.push({
            tokenId: pos.tokenId,
            il,
            currentValue,
            hodlValue,
          });

          calculated++;
          processed++;
          if (processed % 50 === 0) {
            console.log(`  Progress: ${processed}/${positions.length} (calculated=${calculated}, failed=${failed})`);
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

  const avgIL = ilResults.length > 0
    ? ilResults.reduce((sum, r) => sum + r.il, 0) / ilResults.length
    : 0;
  const totalLoss = ilResults.filter(r => r.il < 0).reduce((sum, r) => sum + Math.abs(r.il), 0);
  const totalGain = ilResults.filter(r => r.il > 0).reduce((sum, r) => sum + r.il, 0);

  console.log(`\n✅ IL Calculation Complete:`);
  console.log(`   - Processed: ${processed}`);
  console.log(`   - Calculated: ${calculated}`);
  console.log(`   - Failed: ${failed}`);
  console.log(`   - Average IL: ${avgIL.toFixed(2)}%`);
  console.log(`   - Positions with loss: ${ilResults.filter(r => r.il < 0).length}`);
  console.log(`   - Positions with gain: ${ilResults.filter(r => r.il > 0).length}\n`);

  return { processed, calculated, failed, avgIL, totalLoss, totalGain };
}

async function main() {
  console.log('🚀 Impermanent Loss (IL) Calculation Enrichment Script');
  console.log(`📅 Started: ${new Date().toISOString()}\n`);
  console.log(`⚙️  Configuration:`);
  console.log(`   - Limit: ${limit}`);
  console.log(`   - Offset: ${offset}`);
  console.log(`   - Concurrency: ${concurrency}\n`);

  const startTime = Date.now();
  const results = await enrichImpermanentLoss();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ENRICHMENT SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`⏱️  Total time: ${elapsed}s\n`);
  console.log(`📊 Impermanent Loss:`);
  console.log(`   ✅ Calculated: ${results.calculated}`);
  console.log(`   📈 Average IL: ${results.avgIL.toFixed(2)}%`);
  console.log(`   📉 Total Loss: ${results.totalLoss.toFixed(2)}%`);
  console.log(`   📈 Total Gain: ${results.totalGain.toFixed(2)}%`);
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

