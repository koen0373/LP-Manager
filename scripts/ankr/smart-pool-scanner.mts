#!/usr/bin/env tsx
/**
 * SMART ANKR Pool Events Scanner
 * 
 * Strategy:
 * 1. Quick scan all 238 pools with large windows (10K blocks) to count events
 * 2. Identify top 50 active pools
 * 3. Full scan only those 50 pools
 * 
 * Result: 5-10 min instead of 2+ hours
 */

import 'dotenv/config';
import { Pool as PgPool } from 'pg';
import { createPublicClient, http, decodeEventLog, type Address, type Hex } from 'viem';
import { flare } from 'viem/chains';

const {
  ANKR_API_KEY,
  ANKR_HTTP_URL,
  FLARE_RPC_URL,
  DATABASE_URL,
  RAW_DB,
} = process.env;

const RPC_URL = ANKR_HTTP_URL || FLARE_RPC_URL || `https://rpc.ankr.com/flare/${ANKR_API_KEY}`;
const dsn = (DATABASE_URL && DATABASE_URL.split('?')[0]) || (RAW_DB && RAW_DB.split('?')[0]);

const db = new PgPool({ connectionString: dsn });
const client = createPublicClient({
  chain: flare,
  transport: http(RPC_URL, { timeout: 30000 }),
});

const MINT_ABI = {
  type: 'event',
  name: 'Mint',
  inputs: [
    { type: 'address', name: 'sender', indexed: false },
    { type: 'address', name: 'owner', indexed: true },
    { type: 'int24', name: 'tickLower', indexed: true },
    { type: 'int24', name: 'tickUpper', indexed: true },
    { type: 'uint128', name: 'amount', indexed: false },
    { type: 'uint256', name: 'amount0', indexed: false },
    { type: 'uint256', name: 'amount1', indexed: false },
  ],
} as const;

const BURN_ABI = {
  type: 'event',
  name: 'Burn',
  inputs: [
    { type: 'address', name: 'owner', indexed: true },
    { type: 'int24', name: 'tickLower', indexed: true },
    { type: 'int24', name: 'tickUpper', indexed: true },
    { type: 'uint128', name: 'amount', indexed: false },
    { type: 'uint256', name: 'amount0', indexed: false },
    { type: 'uint256', name: 'amount1', indexed: false },
  ],
} as const;

const COLLECT_ABI = {
  type: 'event',
  name: 'Collect',
  inputs: [
    { type: 'address', name: 'owner', indexed: true },
    { type: 'address', name: 'recipient', indexed: false },
    { type: 'int24', name: 'tickLower', indexed: true },
    { type: 'int24', name: 'tickUpper', indexed: true },
    { type: 'uint128', name: 'amount0', indexed: false },
    { type: 'uint128', name: 'amount1', indexed: false },
  ],
} as const;

interface PoolActivity {
  address: string;
  eventCount: number;
}

async function quickScanPool(poolAddress: string, fromBlock: number, toBlock: number): Promise<number> {
  // Quick scan with large windows to count events only
  const WINDOW = 10000;
  let currentBlock = fromBlock;
  let totalEvents = 0;

  while (currentBlock <= toBlock) {
    const windowEnd = Math.min(currentBlock + WINDOW - 1, toBlock);
    
    try {
      const logs = await client.getLogs({
        address: poolAddress as Address,
        events: [MINT_ABI, BURN_ABI, COLLECT_ABI],
        fromBlock: BigInt(currentBlock),
        toBlock: BigInt(windowEnd),
      });

      totalEvents += logs.length;
      currentBlock = windowEnd + 1;
      
      // Very fast rate limit
      await new Promise(resolve => setTimeout(resolve, 10));
    } catch (error) {
      console.error(`      ❌ Error scanning ${poolAddress.slice(0, 10)}... at ${currentBlock}:`, error);
      break;
    }
  }

  return totalEvents;
}

async function fullScanPool(poolAddress: string, fromBlock: number, toBlock: number): Promise<number> {
  // Full scan with event decoding and database writes
  const WINDOW = 5000;
  let currentBlock = fromBlock;
  let written = 0;

  while (currentBlock <= toBlock) {
    const windowEnd = Math.min(currentBlock + WINDOW - 1, toBlock);
    
    try {
      const logs = await client.getLogs({
        address: poolAddress as Address,
        events: [MINT_ABI, BURN_ABI, COLLECT_ABI],
        fromBlock: BigInt(currentBlock),
        toBlock: BigInt(windowEnd),
      });

      if (logs.length > 0) {
        for (const log of logs) {
          const eventName = (log as any).eventName || 'Unknown';
          const decoded = decodeEventLog({
            abi: [MINT_ABI, BURN_ABI, COLLECT_ABI],
            data: log.data,
            topics: log.topics as [Hex, ...Hex[]],
          });

          const eventId = `${log.transactionHash}:${log.logIndex}`;
          const args = decoded.args as any;

          await db.query(`
            INSERT INTO "PoolEvent" (
              "id", "pool", "blockNumber", "txHash", "logIndex", "timestamp", "eventName",
              "sender", "owner", "recipient", "tickLower", "tickUpper", 
              "amount", "amount0", "amount1", "sqrtPriceX96", "liquidity", "tick"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            ON CONFLICT ("id") DO NOTHING
          `, [
            eventId,
            poolAddress,
            Number(log.blockNumber),
            log.transactionHash,
            Number(log.logIndex),
            Math.floor(Date.now() / 1000),
            eventName,
            args.sender?.toString() || null,
            args.owner?.toString() || null,
            args.recipient?.toString() || null,
            args.tickLower !== undefined ? Number(args.tickLower) : null,
            args.tickUpper !== undefined ? Number(args.tickUpper) : null,
            args.amount?.toString() || null,
            args.amount0?.toString() || null,
            args.amount1?.toString() || null,
            args.sqrtPriceX96?.toString() || null,
            args.liquidity?.toString() || null,
            args.tick !== undefined ? Number(args.tick) : null,
          ]);

          written++;
        }
      }

      currentBlock = windowEnd + 1;
      await new Promise(resolve => setTimeout(resolve, 20));
    } catch (error) {
      console.error(`      ❌ Error at ${currentBlock}:`, error);
      break;
    }
  }

  return written;
}

async function main() {
  console.log(`\n╔════════════════════════════════════════════╗`);
  console.log(`║  SMART Pool Events Scanner (ANKR)         ║`);
  console.log(`╚════════════════════════════════════════════╝\n`);

  // Get all pools
  const poolsRes = await db.query('SELECT "address" FROM "Pool" ORDER BY "blockNumber" ASC');
  const allPools = poolsRes.rows.map(r => r.address);

  console.log(`📊 Found ${allPools.length} pools total`);

  const latestBlock = Number(await client.getBlockNumber()) - 16;
  const START_BLOCK = 29837200;

  console.log(`\n━━━ PHASE 1: Quick Scan (Count Events) ━━━\n`);

  const poolActivity: PoolActivity[] = [];

  // Quick scan all pools in batches
  const QUICK_BATCH = 10;
  for (let i = 0; i < allPools.length; i += QUICK_BATCH) {
    const batch = allPools.slice(i, i + QUICK_BATCH);
    
    const results = await Promise.all(
      batch.map(async (pool, idx) => {
        const globalIdx = i + idx;
        console.log(`   [${globalIdx + 1}/${allPools.length}] Scanning ${pool.slice(0, 10)}...`);
        const count = await quickScanPool(pool, START_BLOCK, latestBlock);
        console.log(`      → ${count} events`);
        return { address: pool, eventCount: count };
      })
    );

    poolActivity.push(...results);
  }

  // Sort by activity
  poolActivity.sort((a, b) => b.eventCount - a.eventCount);

  console.log(`\n━━━ PHASE 2: Full Scan (Top 50 Active Pools) ━━━\n`);

  const TOP_N = 50;
  const activePools = poolActivity.filter(p => p.eventCount > 0).slice(0, TOP_N);

  console.log(`   Active pools: ${poolActivity.filter(p => p.eventCount > 0).length}`);
  console.log(`   Will scan: ${activePools.length} pools\n`);

  let totalWritten = 0;

  // Full scan top pools in smaller batches
  const FULL_BATCH = 5;
  for (let i = 0; i < activePools.length; i += FULL_BATCH) {
    const batch = activePools.slice(i, i + FULL_BATCH);
    
    const results = await Promise.all(
      batch.map(async (pool, idx) => {
        const globalIdx = i + idx;
        console.log(`   [${globalIdx + 1}/${activePools.length}] Full scan ${pool.address.slice(0, 10)}... (estimated ${pool.eventCount} events)`);
        const written = await fullScanPool(pool.address, START_BLOCK, latestBlock);
        console.log(`      ✓ ${written} events written`);
        return written;
      })
    );

    totalWritten += results.reduce((sum, n) => sum + n, 0);
  }

  console.log(`\n━━━ SUMMARY ━━━\n`);
  console.log(`   Total pools: ${allPools.length}`);
  console.log(`   Active pools: ${poolActivity.filter(p => p.eventCount > 0).length}`);
  console.log(`   Scanned fully: ${activePools.length}`);
  console.log(`   Events written: ${totalWritten}`);
  console.log(`\n   Top 10 pools by activity:`);
  
  for (let i = 0; i < Math.min(10, poolActivity.length); i++) {
    const pool = poolActivity[i];
    if (pool.eventCount > 0) {
      console.log(`      ${i + 1}. ${pool.address.slice(0, 10)}... → ${pool.eventCount} events`);
    }
  }

  await db.end();
  console.log(`\n✅ Done!\n`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

