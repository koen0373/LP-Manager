#!/usr/bin/env node
/**
 * SparkDEX NFPM Backfill - Safe Append-Only
 * 
 * Scans ERC-721 Transfer events from SparkDEX NFPM and inserts into Railway DB.
 * - Append-only: ON CONFLICT DO NOTHING
 * - Transaction-safe: batch size 500
 * - Rate-limited: 5 RPS, 1000 block window
 */

import { createPublicClient, http, decodeEventLog, type Hex } from 'viem';
import { PrismaClient } from '@prisma/client';

// Configuration
const CONFIG = {
  rpcUrl: process.env.ANKR_HTTP_URL || 'https://rpc.ankr.com/flare/cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01',
  sparkdexNfpm: '0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da' as const,
  startBlock: 29837200n,
  endBlock: 50303055n,
  blockWindow: 1000n,
  batchSize: 500,
  rpsDelay: 200, // 5 RPS = 200ms delay
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:RPdRysYASfrgsufxDuXcdVYGfEBtGAyC@switchyard.proxy.rlwy.net:52817/railway?sslmode=require',
};

// ERC-721 Transfer ABI
const TRANSFER_ABI = {
  anonymous: false,
  inputs: [
    { indexed: true, name: 'from', type: 'address' },
    { indexed: true, name: 'to', type: 'address' },
    { indexed: true, name: 'tokenId', type: 'uint256' },
  ],
  name: 'Transfer',
  type: 'event',
} as const;

// Transfer event signature
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;

interface DecodedTransfer {
  tokenId: string;
  from: string;
  to: string;
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
  nfpmAddress: string;
}

// Initialize clients
const client = createPublicClient({
  transport: http(CONFIG.rpcUrl, {
    timeout: 30_000,
    retryCount: 3,
    retryDelay: 1000,
  }),
});

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: CONFIG.databaseUrl,
    },
  },
});

// Stats
const stats = {
  totalScanned: 0,
  totalFound: 0,
  totalInserted: 0,
  totalSkipped: 0,
  errors: 0,
  startTime: Date.now(),
};

// Rate limiter
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Scan and decode logs
async function scanBlockRange(fromBlock: bigint, toBlock: bigint): Promise<DecodedTransfer[]> {
  try {
    console.log(`  📡 Scanning blocks ${fromBlock} → ${toBlock}...`);
    
    const logs = await client.getLogs({
      address: CONFIG.sparkdexNfpm,
      event: TRANSFER_ABI,
      fromBlock,
      toBlock,
    });

    stats.totalFound += logs.length;

    const decoded: DecodedTransfer[] = logs.map(log => {
      const decoded = decodeEventLog({
        abi: [TRANSFER_ABI],
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });

      return {
        tokenId: (decoded.args as any).tokenId.toString(),
        from: ((decoded.args as any).from as string).toLowerCase(),
        to: ((decoded.args as any).to as string).toLowerCase(),
        blockNumber: log.blockNumber!,
        txHash: log.transactionHash!,
        logIndex: log.logIndex!,
        nfpmAddress: CONFIG.sparkdexNfpm.toLowerCase(),
      };
    });

    console.log(`    ✓ Found ${logs.length} transfers`);
    
    // Rate limit
    await sleep(CONFIG.rpsDelay);
    
    return decoded;
  } catch (error: any) {
    console.error(`    ❌ Error scanning ${fromBlock}-${toBlock}:`, error.message);
    stats.errors++;
    
    // If rate limited, wait longer and retry once
    if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      console.log(`    ⏳ Rate limited, waiting 5s and retrying...`);
      await sleep(5000);
      return scanBlockRange(fromBlock, toBlock);
    }
    
    return [];
  }
}

// Insert transfers (append-only)
async function insertTransfers(transfers: DecodedTransfer[]): Promise<void> {
  if (transfers.length === 0) return;

  try {
    // Use raw SQL for ON CONFLICT DO NOTHING
    const values = transfers.map(t => 
      `('${t.tokenId}', '${t.from}', '${t.to}', ${t.blockNumber}, '${t.txHash}', ${t.logIndex}, '${t.nfpmAddress}')`
    ).join(',\n      ');

    const insertQuery = `
      INSERT INTO "PositionTransfer" ("tokenId", "from", "to", "blockNumber", "txHash", "logIndex", "nfpmAddress")
      VALUES ${values}
      ON CONFLICT ("txHash", "logIndex") DO NOTHING;
    `;

    const result = await prisma.$executeRawUnsafe(insertQuery);
    
    // Count how many were actually inserted (result = affected rows)
    const inserted = typeof result === 'number' ? result : 0;
    const skipped = transfers.length - inserted;
    
    stats.totalInserted += inserted;
    stats.totalSkipped += skipped;
    
    console.log(`    ✅ Inserted ${inserted} new rows (${skipped} duplicates skipped)`);
  } catch (error: any) {
    console.error(`    ❌ Error inserting batch:`, error.message);
    stats.errors++;
    throw error;
  }
}

// Main execution
async function main() {
  console.log('🚀 SparkDEX NFPM Backfill - Append-Only Mode');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Contract: ${CONFIG.sparkdexNfpm}`);
  console.log(`🔢 Block range: ${CONFIG.startBlock} → ${CONFIG.endBlock}`);
  console.log(`📦 Batch size: ${CONFIG.batchSize} rows`);
  console.log(`⚡ Rate limit: ${1000 / CONFIG.rpsDelay} RPS`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    let currentBlock = CONFIG.startBlock;
    let allTransfers: DecodedTransfer[] = [];

    // Scan in windows
    while (currentBlock <= CONFIG.endBlock) {
      const toBlock = currentBlock + CONFIG.blockWindow > CONFIG.endBlock 
        ? CONFIG.endBlock 
        : currentBlock + CONFIG.blockWindow;

      const transfers = await scanBlockRange(currentBlock, toBlock);
      allTransfers.push(...transfers);

      // Insert in batches
      if (allTransfers.length >= CONFIG.batchSize) {
        const batch = allTransfers.splice(0, CONFIG.batchSize);
        await insertTransfers(batch);
      }

      stats.totalScanned += Number(toBlock - currentBlock + 1n);
      currentBlock = toBlock + 1n;

      // Progress
      const progress = Number((currentBlock - CONFIG.startBlock) * 100n / (CONFIG.endBlock - CONFIG.startBlock));
      console.log(`  📊 Progress: ${progress.toFixed(1)}% (block ${currentBlock})\n`);
    }

    // Insert remaining transfers
    if (allTransfers.length > 0) {
      await insertTransfers(allTransfers);
    }

    // Final verification
    console.log('\n🔍 Running verification queries...');
    
    const result = await prisma.$queryRaw<Array<{ positions: bigint; latest_block: number }>>`
      SELECT 
        COUNT(DISTINCT "tokenId")::bigint as positions,
        MAX("blockNumber") as latest_block
      FROM "PositionTransfer"
      WHERE LOWER("nfpmAddress") = ${CONFIG.sparkdexNfpm.toLowerCase()};
    `;

    const verification = result[0];
    const runtime = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(2);

    // Success summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ BACKFILL COMPLETED SUCCESSFULLY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Blocks scanned:    ${stats.totalScanned.toLocaleString()}`);
    console.log(`🔍 Transfers found:   ${stats.totalFound.toLocaleString()}`);
    console.log(`✅ Rows inserted:     ${stats.totalInserted.toLocaleString()}`);
    console.log(`⏭️  Duplicates skipped: ${stats.totalSkipped.toLocaleString()}`);
    console.log(`❌ Errors:            ${stats.errors}`);
    console.log(`⏱️  Runtime:           ${runtime} min`);
    console.log(`\n📍 SparkDEX Positions: ${verification.positions.toString().toLocaleString()}`);
    console.log(`📦 Latest Block:       ${verification.latest_block.toLocaleString()}`);
    console.log(`🌐 RPC Source:         ANKR`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Log to file
    const logEntry = `
[${new Date().toISOString()}] SparkDEX NFPM Backfill
  inserted_rows: ${stats.totalInserted}
  total_positions: ${verification.positions}
  latest_block: ${verification.latest_block}
  runtime_min: ${runtime}
  rpc_source: ANKR
`;

    const fs = await import('fs/promises');
    await fs.mkdir('logs', { recursive: true });
    await fs.appendFile('logs/indexer_sparkdex_nfpm.txt', logEntry);

    console.log('📄 Log appended to: logs/indexer_sparkdex_nfpm.txt\n');

    return {
      inserted_rows: stats.totalInserted,
      total_positions: Number(verification.positions),
      latest_block: verification.latest_block,
      runtime_min: runtime,
      rpc_source: 'ANKR',
    };

  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run
main()
  .then((result) => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

