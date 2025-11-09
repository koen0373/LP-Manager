#!/usr/bin/env tsx
/**
 * ANKR Factory & Pool Events Scanner
 * 
 * Fetches PoolCreated events from Enosys and SparkDEX factories,
 * then fetches pool contract events (Swap/Mint/Burn/Collect) for all discovered pools.
 * 
 * Usage:
 *   tsx scripts/ankr/fetch-factories-pools.mts [--factory=enosys|sparkdex|all] [--dry-run]
 */

import 'dotenv/config';
import { Pool as PgPool } from 'pg';
import { createPublicClient, http, decodeEventLog, type Log, type Address, type Hex } from 'viem';
import { flare } from 'viem/chains';

// Environment
const {
  ANKR_API_KEY,
  ANKR_HTTP_URL,
  FLARE_RPC_URL,
  ENOSYS_V3_FACTORY,
  SPARKDEX_V3_FACTORY,
  DATABASE_URL,
  RAW_DB,
} = process.env;

const RPC_URL = ANKR_HTTP_URL || FLARE_RPC_URL || `https://rpc.ankr.com/flare/${ANKR_API_KEY}`;
const dsn = (DATABASE_URL && DATABASE_URL.split('?')[0]) || (RAW_DB && RAW_DB.split('?')[0]) || 'postgresql://koen@localhost:5432/liquilab';

const db = new PgPool({ connectionString: dsn });
const client = createPublicClient({
  chain: flare,
  transport: http(RPC_URL, { timeout: 30000 }),
});

// PoolCreated event ABI
const POOL_CREATED_ABI = {
  type: 'event',
  name: 'PoolCreated',
  inputs: [
    { type: 'address', name: 'token0', indexed: true },
    { type: 'address', name: 'token1', indexed: true },
    { type: 'uint24', name: 'fee', indexed: true },
    { type: 'int24', name: 'tickSpacing', indexed: false },
    { type: 'address', name: 'pool', indexed: false },
  ],
} as const;

// Pool events ABIs
const SWAP_ABI = {
  type: 'event',
  name: 'Swap',
  inputs: [
    { type: 'address', name: 'sender', indexed: true },
    { type: 'address', name: 'recipient', indexed: true },
    { type: 'int256', name: 'amount0', indexed: false },
    { type: 'int256', name: 'amount1', indexed: false },
    { type: 'uint160', name: 'sqrtPriceX96', indexed: false },
    { type: 'uint128', name: 'liquidity', indexed: false },
    { type: 'int24', name: 'tick', indexed: false },
  ],
} as const;

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

interface FactoryConfig {
  name: string;
  address: string;
  startBlock: number;
}

const FACTORIES: Record<string, FactoryConfig> = {
  enosys: {
    name: 'Enosys',
    address: ENOSYS_V3_FACTORY!.toLowerCase(),
    startBlock: 29837200,
  },
  sparkdex: {
    name: 'SparkDEX',
    address: SPARKDEX_V3_FACTORY!.toLowerCase(),
    startBlock: 30617263,
  },
};

async function ensureTables() {
  console.log('🔧 Ensuring database tables...');
  
  // Ensure Pool table
  await db.query(`
    CREATE TABLE IF NOT EXISTS "Pool" (
      "address" TEXT PRIMARY KEY,
      "token0" TEXT NOT NULL,
      "token1" TEXT NOT NULL,
      "fee" INTEGER NOT NULL,
      "factory" TEXT NOT NULL,
      "blockNumber" INTEGER NOT NULL,
      "txHash" TEXT NOT NULL,
      "token0Symbol" TEXT,
      "token1Symbol" TEXT,
      "token0Name" TEXT,
      "token1Name" TEXT,
      "token0Decimals" INTEGER,
      "token1Decimals" INTEGER,
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "Pool_factory_idx" ON "Pool"("factory");
    CREATE INDEX IF NOT EXISTS "Pool_tokens_idx" ON "Pool"("token0", "token1");
  `);

  // Ensure PoolEvent table
  await db.query(`
    CREATE TABLE IF NOT EXISTS "PoolEvent" (
      "id" TEXT PRIMARY KEY,
      "pool" TEXT NOT NULL,
      "blockNumber" INTEGER NOT NULL,
      "txHash" TEXT NOT NULL,
      "logIndex" INTEGER NOT NULL,
      "timestamp" INTEGER NOT NULL,
      "eventName" TEXT NOT NULL,
      "sender" TEXT,
      "owner" TEXT,
      "recipient" TEXT,
      "tickLower" INTEGER,
      "tickUpper" INTEGER,
      "amount" TEXT,
      "amount0" TEXT,
      "amount1" TEXT,
      "sqrtPriceX96" TEXT,
      "liquidity" TEXT,
      "tick" INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "PoolEvent_tx_log_idx" ON "PoolEvent"("txHash", "logIndex");
    CREATE INDEX IF NOT EXISTS "PoolEvent_pool_block_idx" ON "PoolEvent"("pool", "blockNumber");
    CREATE INDEX IF NOT EXISTS "PoolEvent_name_idx" ON "PoolEvent"("eventName");
  `);

  // Ensure SyncCheckpoint table
  await db.query(`
    CREATE TABLE IF NOT EXISTS "SyncCheckpoint" (
      "id" TEXT PRIMARY KEY,
      "lastBlock" INTEGER NOT NULL,
      "eventsCount" INTEGER DEFAULT 0,
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log('✅ Tables ready\n');
}

async function getCheckpoint(source: string, key: string): Promise<number | null> {
  const res = await db.query('SELECT "lastBlock" FROM "SyncCheckpoint" WHERE "source" = $1 AND "key" = $2', [source, key]);
  return res.rows[0]?.lastBlock || null;
}

async function saveCheckpoint(source: string, key: string, lastBlock: number, eventsCount: number) {
  const id = `${source}:${key}`;
  await db.query(`
    INSERT INTO "SyncCheckpoint" ("id", "source", "key", "lastBlock", "eventsCount", "updatedAt", "createdAt")
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "lastBlock" = EXCLUDED."lastBlock",
      "eventsCount" = "SyncCheckpoint"."eventsCount" + EXCLUDED."eventsCount",
      "updatedAt" = NOW()
  `, [id, source, key, lastBlock, eventsCount]);
}

async function fetchPoolCreatedEvents(factory: FactoryConfig, dryRun: boolean) {
  console.log(`\n📡 Fetching PoolCreated events for ${factory.name}...`);
  
  const source = 'FACTORY';
  const key = factory.name.toLowerCase();
  const fromBlock = (await getCheckpoint(source, key)) || factory.startBlock;
  const latestBlock = Number(await client.getBlockNumber()) - 16; // 16 block confirmation

  if (fromBlock > latestBlock) {
    console.log(`   ℹ️  Already synced (at block ${fromBlock})`);
    return;
  }

  console.log(`   Scanning ${fromBlock} → ${latestBlock} (${latestBlock - fromBlock + 1} blocks)`);

  const WINDOW = 2000;
  let processed = 0;
  let currentBlock = fromBlock;

  while (currentBlock <= latestBlock) {
    const toBlock = Math.min(currentBlock + WINDOW - 1, latestBlock);
    
    try {
      const logs = await client.getLogs({
        address: factory.address as Address,
        event: POOL_CREATED_ABI,
        fromBlock: BigInt(currentBlock),
        toBlock: BigInt(toBlock),
      });

      if (logs.length > 0) {
        console.log(`   [${currentBlock}→${toBlock}] Found ${logs.length} pools`);

        for (const log of logs) {
          const decoded = decodeEventLog({
            abi: [POOL_CREATED_ABI],
            data: log.data,
            topics: log.topics as [Hex, ...Hex[]],
          });

          const pool = (decoded.args.pool as string).toLowerCase();
          const token0 = (decoded.args.token0 as string).toLowerCase();
          const token1 = (decoded.args.token1 as string).toLowerCase();
          const fee = Number(decoded.args.fee);

          if (!dryRun) {
            // Insert into Pool table
            await db.query(`
              INSERT INTO "Pool" ("address", "token0", "token1", "fee", "factory", "blockNumber", "txHash")
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT ("address") DO NOTHING
            `, [pool, token0, token1, fee, factory.address, Number(log.blockNumber), log.transactionHash]);

            // Insert into PoolEvent table
            const eventId = `${log.transactionHash}:${log.logIndex}`;
            await db.query(`
              INSERT INTO "PoolEvent" ("id", "pool", "blockNumber", "txHash", "logIndex", "timestamp", "eventName")
              VALUES ($1, $2, $3, $4, $5, $6, 'PoolCreated')
              ON CONFLICT ("id") DO NOTHING
            `, [eventId, pool, Number(log.blockNumber), log.transactionHash, Number(log.logIndex), Math.floor(Date.now() / 1000)]);
          }

          processed++;
        }
      }

      currentBlock = toBlock + 1;

      // Save checkpoint every 10 windows
      if (!dryRun && (currentBlock - fromBlock) % (WINDOW * 10) === 0) {
        await saveCheckpoint(source, key, toBlock, logs.length);
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`   ❌ Error at ${currentBlock}:`, error);
      throw error;
    }
  }

  if (!dryRun) {
    await saveCheckpoint(source, key, latestBlock, 0);
  }

  console.log(`   ✅ Processed ${processed} PoolCreated events`);
}

async function fetchPoolEvents(dryRun: boolean) {
  console.log(`\n📡 Fetching pool contract events (Mint/Burn/Collect)...`);

  // Get all pools
  const poolsRes = await db.query('SELECT "address", "factory" FROM "Pool" ORDER BY "blockNumber" ASC');
  const pools = poolsRes.rows;

  console.log(`   Found ${pools.length} pools to scan`);

  const latestBlock = Number(await client.getBlockNumber()) - 16;
  const START_BLOCK = 29837200; // Earliest factory block

  let totalEvents = 0;

  // Process pools in parallel batches for speed
  const BATCH_SIZE = 5; // Process 5 pools simultaneously
  
  for (let batchStart = 0; batchStart < pools.length; batchStart += BATCH_SIZE) {
    const batch = pools.slice(batchStart, batchStart + BATCH_SIZE);
    
    await Promise.all(batch.map(async (pool, idx) => {
      const i = batchStart + idx;
      const source = 'POOL';
      const key = pool.address;
      const fromBlock = (await getCheckpoint(source, key)) || START_BLOCK;

      if (fromBlock > latestBlock) return;

      console.log(`   [${i + 1}/${pools.length}] ${pool.address.slice(0, 10)}... (${fromBlock}→${latestBlock})`);

      const WINDOW = 5000; // Increased from 1000
      let currentBlock = fromBlock;
      let poolEvents = 0;

      while (currentBlock <= latestBlock) {
        const toBlock = Math.min(currentBlock + WINDOW - 1, latestBlock);

        try {
          const logs = await client.getLogs({
            address: pool.address as Address,
            events: [MINT_ABI, BURN_ABI, COLLECT_ABI], // Skip SWAP (trader events, not LP events)
            fromBlock: BigInt(currentBlock),
            toBlock: BigInt(toBlock),
          });

          if (logs.length > 0 && !dryRun) {
            for (const log of logs) {
              const eventName = (log as any).eventName || 'Unknown';
              const decoded = decodeEventLog({
                abi: [MINT_ABI, BURN_ABI, COLLECT_ABI], // Skip SWAP
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
                pool.address,
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

              poolEvents++;
            }
          }

          currentBlock = toBlock + 1;

          // Rate limit (reduced from 50ms to 20ms for speed)
          await new Promise(resolve => setTimeout(resolve, 20));

        } catch (error) {
          console.error(`      ❌ Error at ${currentBlock}:`, error);
          break; // Skip this pool on error
        }
      }

      if (!dryRun && poolEvents > 0) {
        await saveCheckpoint(source, key, latestBlock, poolEvents);
        console.log(`      ✓ ${poolEvents} events`);
        totalEvents += poolEvents;
      }
    }));
  }

  console.log(`   ✅ Total pool events: ${totalEvents}`);
}

async function main() {
  const args = process.argv.slice(2);
  const factoryArg = args.find(a => a.startsWith('--factory='))?.split('=')[1] || 'all';
  const dryRun = args.includes('--dry-run');

  console.log(`\n╔════════════════════════════════════════════╗`);
  console.log(`║  ANKR Factory & Pool Events Scanner       ║`);
  console.log(`╚════════════════════════════════════════════╝\n`);
  console.log(`Factory: ${factoryArg}`);
  console.log(`Dry run: ${dryRun}\n`);

  await ensureTables();

  // Fetch PoolCreated events
  if (factoryArg === 'all' || factoryArg === 'enosys') {
    await fetchPoolCreatedEvents(FACTORIES.enosys, dryRun);
  }
  if (factoryArg === 'all' || factoryArg === 'sparkdex') {
    await fetchPoolCreatedEvents(FACTORIES.sparkdex, dryRun);
  }

  // Fetch pool contract events
  if (!dryRun) {
    await fetchPoolEvents(dryRun);
  }

  await db.end();
  console.log(`\n✅ Done!\n`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

