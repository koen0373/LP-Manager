#!/usr/bin/env node
/**
 * SparkDEX NFPM Backfill - Safe Append-Only (Raw RPC version)
 * 
 * Uses raw JSON-RPC calls to avoid Viem module issues
 */

const { PrismaClient } = require('@prisma/client');

// Configuration
const CONFIG = {
  rpcUrl: 'https://rpc.ankr.com/flare/cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01',
  sparkdexNfpm: '0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da',
  startBlock: 29837200,
  endBlock: 50303055,
  blockWindow: 5000, // Increased from 1000 to 5000
  batchSize: 500,
  rpsDelay: 150, // Slightly faster: 6.67 RPS
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:RPdRysYASfrgsufxDuXcdVYGfEBtGAyC@switchyard.proxy.rlwy.net:52817/railway?sslmode=require',
};

// Transfer event signature (ERC-721)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Stats
const stats = {
  totalScanned: 0,
  totalFound: 0,
  totalInserted: 0,
  totalSkipped: 0,
  errors: 0,
  startTime: Date.now(),
};

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: CONFIG.databaseUrl,
    },
  },
});

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// RPC call
async function rpcCall(method, params) {
  const response = await fetch(CONFIG.rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`RPC Error: ${data.error.message || JSON.stringify(data.error)}`);
  }
  
  return data.result;
}

// Decode transfer log
function decodeTransferLog(log) {
  // Topics: [signature, from (indexed), to (indexed), tokenId (indexed)]
  if (log.topics.length !== 4) return null;
  
  const from = '0x' + log.topics[1].slice(26).toLowerCase(); // Remove padding
  const to = '0x' + log.topics[2].slice(26).toLowerCase();
  const tokenId = BigInt(log.topics[3]).toString();
  
  return {
    tokenId,
    from,
    to,
    blockNumber: parseInt(log.blockNumber, 16),
    txHash: log.transactionHash.toLowerCase(),
    logIndex: parseInt(log.logIndex, 16),
    nfpmAddress: CONFIG.sparkdexNfpm.toLowerCase(),
  };
}

// Scan block range
async function scanBlockRange(fromBlock, toBlock) {
  try {
    console.log(`  📡 Scanning blocks ${fromBlock} → ${toBlock}...`);
    
    const logs = await rpcCall('eth_getLogs', [{
      address: CONFIG.sparkdexNfpm,
      topics: [TRANSFER_TOPIC],
      fromBlock: '0x' + fromBlock.toString(16),
      toBlock: '0x' + toBlock.toString(16),
    }]);

    stats.totalFound += logs.length;

    const decoded = logs
      .map(decodeTransferLog)
      .filter(Boolean);

    console.log(`    ✓ Found ${logs.length} transfers`);
    
    await sleep(CONFIG.rpsDelay);
    
    return decoded;
  } catch (error) {
    console.error(`    ❌ Error scanning ${fromBlock}-${toBlock}:`, error.message);
    stats.errors++;
    
    if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      console.log(`    ⏳ Rate limited, waiting 5s and retrying...`);
      await sleep(5000);
      return scanBlockRange(fromBlock, toBlock);
    }
    
    return [];
  }
}

// Insert transfers (append-only)
async function insertTransfers(transfers) {
  if (transfers.length === 0) return;

  try {
    // Generate UUIDs and estimate timestamps for each row
    const values = transfers.map(t => {
      const uuid = require('crypto').randomUUID();
      // Estimate timestamp: Flare has ~1.5s block time, genesis ~Jul 2023
      // Block 29837200 ≈ 1689000000 (July 2023), current ≈ 1730000000
      // Rough estimate: 1689000000 + (blockNumber - 29837200) * 1.5
      const estimatedTimestamp = Math.floor(1689000000 + (t.blockNumber - 29837200) * 1.5);
      return `('${uuid}', '${t.tokenId}', '${t.from}', '${t.to}', ${t.blockNumber}, '${t.txHash}', ${t.logIndex}, ${estimatedTimestamp}, '${t.nfpmAddress}')`;
    }).join(',\n      ');

    const insertQuery = `
      INSERT INTO "PositionTransfer" ("id", "tokenId", "from", "to", "blockNumber", "txHash", "logIndex", "timestamp", "nfpmAddress")
      VALUES ${values}
      ON CONFLICT ("txHash", "logIndex") DO NOTHING;
    `;

    const result = await prisma.$executeRawUnsafe(insertQuery);
    
    const inserted = typeof result === 'number' ? result : 0;
    const skipped = transfers.length - inserted;
    
    stats.totalInserted += inserted;
    stats.totalSkipped += skipped;
    
    console.log(`    ✅ Inserted ${inserted} new rows (${skipped} duplicates skipped)`);
  } catch (error) {
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
    let allTransfers = [];

    while (currentBlock <= CONFIG.endBlock) {
      const toBlock = Math.min(currentBlock + CONFIG.blockWindow, CONFIG.endBlock);

      const transfers = await scanBlockRange(currentBlock, toBlock);
      allTransfers.push(...transfers);

      if (allTransfers.length >= CONFIG.batchSize) {
        const batch = allTransfers.splice(0, CONFIG.batchSize);
        await insertTransfers(batch);
      }

      stats.totalScanned += (toBlock - currentBlock + 1);
      currentBlock = toBlock + 1;

      const progress = ((currentBlock - CONFIG.startBlock) * 100 / (CONFIG.endBlock - CONFIG.startBlock)).toFixed(1);
      console.log(`  📊 Progress: ${progress}% (block ${currentBlock})\n`);
    }

    if (allTransfers.length > 0) {
      await insertTransfers(allTransfers);
    }

    console.log('\n🔍 Running verification queries...');
    
    const result = await prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT "tokenId")::bigint as positions,
        MAX("blockNumber") as latest_block
      FROM "PositionTransfer"
      WHERE LOWER("nfpmAddress") = ${CONFIG.sparkdexNfpm.toLowerCase()};
    `;

    const verification = result[0];
    const runtime = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(2);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ BACKFILL COMPLETED SUCCESSFULLY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Blocks scanned:    ${stats.totalScanned.toLocaleString()}`);
    console.log(`🔍 Transfers found:   ${stats.totalFound.toLocaleString()}`);
    console.log(`✅ Rows inserted:     ${stats.totalInserted.toLocaleString()}`);
    console.log(`⏭️  Duplicates skipped: ${stats.totalSkipped.toLocaleString()}`);
    console.log(`❌ Errors:            ${stats.errors}`);
    console.log(`⏱️  Runtime:           ${runtime} min`);
    console.log(`\n📍 SparkDEX Positions: ${verification.positions.toString()}`);
    console.log(`📦 Latest Block:       ${verification.latest_block.toLocaleString()}`);
    console.log(`🌐 RPC Source:         ANKR`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const fs = require('fs/promises');
    await fs.mkdir('logs', { recursive: true });
    
    const logEntry = `
[${new Date().toISOString()}] SparkDEX NFPM Backfill
  inserted_rows: ${stats.totalInserted}
  total_positions: ${verification.positions}
  latest_block: ${verification.latest_block}
  runtime_min: ${runtime}
  rpc_source: ANKR
`;
    await fs.appendFile('logs/indexer_sparkdex_nfpm.txt', logEntry);

    console.log('📄 Log appended to: logs/indexer_sparkdex_nfpm.txt\n');

    return {
      inserted_rows: stats.totalInserted,
      total_positions: Number(verification.positions),
      latest_block: verification.latest_block,
      runtime_min: runtime,
      rpc_source: 'ANKR',
    };

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

