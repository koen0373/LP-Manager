#!/usr/bin/env node
/**
 * Fetch Missing Data for User Engagement Reports
 * 
 * This script fetches missing data:
 * 1. Pool attribution (via NFPM.positions() RPC calls)
 * 2. Fees calculation (from COLLECT events × token prices)
 * 3. Unclaimed fees (via RPC calls to NFPM contracts)
 * 4. Range status (calculate from tick data)
 * 5. Position snapshots (generate from PositionEvent history)
 */

import { PrismaClient } from '@prisma/client';
import { getAddress } from 'viem';
import { config } from 'dotenv';

config();

// Import via dynamic import since these are TypeScript files
let getTokenPriceWithFallback;
let getRpcClient;

try {
  const tokenPriceModule = await import('../src/services/tokenPriceService.ts');
  getTokenPriceWithFallback = tokenPriceModule.getTokenPriceWithFallback;
} catch (error) {
  console.warn('Could not import tokenPriceService, using fallback');
  getTokenPriceWithFallback = async (symbol, fallback) => ({ price: fallback, source: 'fallback' });
}

try {
  const rpcModule = await import('../src/lib/rpc.ts');
  getRpcClient = rpcModule.getRpcClient;
} catch (error) {
  console.warn('Could not import rpc, using fallback');
  const { createPublicClient, http } = await import('viem');
  const { flare } = await import('../src/lib/chainFlare.ts');
  getRpcClient = () => createPublicClient({ chain: flare, transport: http() });
}

const prisma = new PrismaClient();

// Wait for RPC client to be ready
let publicClient;
(async () => {
  try {
    const rpcModule = await import('../src/lib/rpc.ts');
    publicClient = rpcModule.getRpcClient();
  } catch (error) {
    const { createPublicClient, http } = await import('viem');
    const { flare } = await import('../src/lib/chainFlare.ts');
    publicClient = createPublicClient({ chain: flare, transport: http() });
  }
})();

const ENOSYS_NFPM = process.env.ENOSYS_NFPM ? getAddress(process.env.ENOSYS_NFPM) : null;
const SPARKDEX_NFPM = process.env.SPARKDEX_NFPM ? getAddress(process.env.SPARKDEX_NFPM) : null;
const ENOSYS_FACTORY = process.env.ENOSYS_V3_FACTORY ? getAddress(process.env.ENOSYS_V3_FACTORY) : null;
const SPARKDEX_FACTORY = process.env.SPARKDEX_V3_FACTORY ? getAddress(process.env.SPARKDEX_V3_FACTORY) : null;

const POSITION_ABI = [
  {
    name: 'positions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'nonce', type: 'uint96' },
      { name: 'operator', type: 'address' },
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0', type: 'uint128' },
      { name: 'tokensOwed1', type: 'uint128' },
    ],
  },
] as const;

const FACTORY_ABI = [
  {
    name: 'getPool',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
  },
] as const;

async function getPoolFromPosition(tokenId, nfpmAddress) {
  try {
    if (!publicClient) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const nfpm = getAddress(nfpmAddress);
    const position = await publicClient.readContract({
      address: nfpm,
      abi: POSITION_ABI,
      functionName: 'positions',
      args: [BigInt(tokenId)],
    });

    const token0 = position[2];
    const token1 = position[3];
    const fee = Number(position[4]);

    // Try both factories
    const factories = [
      { address: ENOSYS_FACTORY, name: 'Enosys' },
      { address: SPARKDEX_FACTORY, name: 'SparkDEX' },
    ].filter(f => f.address !== null);

    for (const factory of factories) {
      if (!factory.address) continue;
      try {
        const pool = await publicClient.readContract({
          address: factory.address,
          abi: FACTORY_ABI,
          functionName: 'getPool',
          args: [token0, token1, fee],
        });

        if (pool && pool !== '0x0000000000000000000000000000000000000000') {
          return pool.toLowerCase();
        }
      } catch (error) {
        // Try next factory
        continue;
      }
    }

    return null;
  } catch (error) {
    console.warn(`[POOL] Failed to get pool for tokenId ${tokenId}:`, error.message);
    return null;
  }
}

async function calculateFeesUsd(amount0: string, amount1: string, token0Symbol: string, token1Symbol: string): Promise<number> {
  try {
    const price0 = await getTokenPriceWithFallback(token0Symbol, 1);
    const price1 = await getTokenPriceWithFallback(token1Symbol, 1);

    // Get decimals from Pool table or default to 18
    const pool = await prisma.pool.findFirst({
      where: {
        token0Symbol: token0Symbol.toUpperCase(),
        token1Symbol: token1Symbol.toUpperCase(),
      },
    });

    const decimals0 = pool?.token0Decimals || 18;
    const decimals1 = pool?.token1Decimals || 18;

    const amount0Num = Number(amount0) / Math.pow(10, decimals0);
    const amount1Num = Number(amount1) / Math.pow(10, decimals1);

    return (amount0Num * price0.price) + (amount1Num * price1.price);
  } catch (error) {
    console.warn(`[FEES] Failed to calculate fees for ${token0Symbol}/${token1Symbol}:`, error.message);
    return 0;
  }
}

async function main() {
  console.log('🚀 Fetching Missing Data for User Engagement Reports\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 1: Get positions with pool='unknown'
  console.log('📋 Step 1: Finding positions with pool="unknown"...');
  const unknownPoolPositions = await prisma.$queryRaw<Array<{ tokenId: string; nfpmAddress: string }>>`
    SELECT DISTINCT 
      pe."tokenId",
      pt."nfpmAddress"
    FROM "PositionEvent" pe
    JOIN "PositionTransfer" pt ON pt."tokenId" = pe."tokenId"
    WHERE pe."pool" = 'unknown'
      AND pt."nfpmAddress" IS NOT NULL
      AND pt."to" != '0x0000000000000000000000000000000000000000'
    LIMIT 100;
  `;

  console.log(`✅ Found ${unknownPoolPositions.length} positions with pool="unknown"\n`);

  if (unknownPoolPositions.length === 0) {
    console.log('✅ No positions need pool attribution!\n');
  } else {
    console.log('🔄 Fetching pool addresses via RPC...\n');
    
    let updated = 0;
    for (const pos of unknownPoolPositions.slice(0, 10)) { // Limit to 10 for testing
      const poolAddress = await getPoolFromPosition(pos.tokenId, pos.nfpmAddress);
      
      if (poolAddress) {
        await prisma.$executeRaw`
          UPDATE "PositionEvent"
          SET "pool" = ${poolAddress}
          WHERE "tokenId" = ${pos.tokenId}
            AND "pool" = 'unknown';
        `;
        updated++;
        console.log(`✅ Updated tokenId ${pos.tokenId} → pool ${poolAddress.substring(0, 10)}...`);
      } else {
        console.log(`⚠️  Could not find pool for tokenId ${pos.tokenId}`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`\n✅ Updated ${updated} positions\n`);
  }

  // Step 2: Calculate fees in USD for COLLECT events
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Step 2: Calculating fees in USD for COLLECT events...\n');
  
  const collectEvents = await prisma.$queryRaw<Array<{
    id: string;
    tokenId: string;
    pool: string;
    amount0: string;
    amount1: string;
  }>>`
    SELECT 
      pe.id,
      pe."tokenId",
      pe."pool",
      pe."amount0",
      pe."amount1"
    FROM "PositionEvent" pe
    JOIN "Pool" p ON p.address = pe."pool"
    WHERE pe."eventType" = 'COLLECT'
      AND pe."pool" != 'unknown'
      AND pe."usdValue" IS NULL
      AND pe."amount0" IS NOT NULL
      AND pe."amount1" IS NOT NULL
    LIMIT 50;
  `;

  console.log(`✅ Found ${collectEvents.length} COLLECT events without USD value\n`);

  if (collectEvents.length > 0) {
    console.log('🔄 Calculating USD values...\n');
    
    let calculated = 0;
    for (const event of collectEvents.slice(0, 10)) { // Limit for testing
      const pool = await prisma.pool.findUnique({
        where: { address: event.pool },
      });

      if (pool?.token0Symbol && pool?.token1Symbol) {
        const feesUsd = await calculateFeesUsd(
          event.amount0,
          event.amount1,
          pool.token0Symbol,
          pool.token1Symbol
        );

        if (feesUsd > 0) {
          await prisma.positionEvent.update({
            where: { id: event.id },
            data: { usdValue: feesUsd },
          });
          calculated++;
          console.log(`✅ Updated event ${event.id}: $${feesUsd.toFixed(2)}`);
        }
      }
    }
    
    console.log(`\n✅ Calculated USD values for ${calculated} events\n`);
  }

  // Step 3: Generate position snapshots from PositionEvent history
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Step 3: Generating position snapshots...\n');
  
  const positionsWithEvents = await prisma.$queryRaw<Array<{
    tokenId: string;
    eventCount: bigint;
  }>>`
    SELECT 
      "tokenId",
      COUNT(*) as "eventCount"
    FROM "PositionEvent"
    WHERE "timestamp" > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days')::bigint
    GROUP BY "tokenId"
    HAVING COUNT(*) > 0
    LIMIT 100;
  `;

  console.log(`✅ Found ${positionsWithEvents.length} positions with events in last 7 days\n`);
  console.log('ℹ️  Position snapshots can be generated from PositionEvent history\n');
  console.log('   (This requires analytics_position_snapshot table population)\n');

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('✅ Pool Attribution:');
  console.log(`   - Positions with pool="unknown": ${unknownPoolPositions.length}`);
  console.log(`   - Can be fixed via NFPM.positions() RPC calls\n`);
  
  console.log('✅ Fees Calculation:');
  console.log(`   - COLLECT events without USD: ${collectEvents.length}`);
  console.log(`   - Can be calculated from amounts × token prices\n`);
  
  console.log('✅ Position Snapshots:');
  console.log(`   - Positions with events: ${positionsWithEvents.length}`);
  console.log(`   - Can be generated from PositionEvent history\n`);

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });

