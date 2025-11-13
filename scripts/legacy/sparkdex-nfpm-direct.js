// Direct SparkDEX NFPM Scanner (plain JS for node)
// No tsx dependency needed

const { Pool } = require('pg');
const { createPublicClient, http, decodeEventLog } = require('viem');
const { flare } = require('viem/chains');

const ANKR_KEY = 'cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01';
const RPC_URL = `https://rpc.ankr.com/flare/${ANKR_KEY}`;
const DB_URL = 'postgresql://postgres:RPdRysYASfrgsufxDuXcdVYGfEBtGAyC@switchyard.proxy.rlwy.net:52817/railway';
const SPARKDEX_NFPM = '0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da';

const TRANSFER_ABI = [{
  type: 'event',
  name: 'Transfer',
  inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
  ],
}];

async function main() {
  console.log('🚀 [SparkDEX NFPM Backfill] Starting...\n');
  console.log('NFPM:', SPARKDEX_NFPM);
  console.log('RPC: ANKR\n');

  const client = createPublicClient({
    chain: flare,
    transport: http(RPC_URL),
  });

  const db = new Pool({ connectionString: DB_URL });

  try {
    const latestBlock = await client.getBlockNumber();
    const START_BLOCK = 29_837_200;
    const WINDOW = 1000;
    
    console.log(`Latest block: ${latestBlock}`);
    console.log(`Scanning: ${START_BLOCK} → ${latestBlock}\n`);

    let current = START_BLOCK;
    let totalEvents = 0;

    while (current < latestBlock) {
      const end = Math.min(current + WINDOW, Number(latestBlock));
      
      try {
        const logs = await client.getLogs({
          address: SPARKDEX_NFPM,
          event: TRANSFER_ABI[0],
          fromBlock: BigInt(current),
          toBlock: BigInt(end),
        });

        if (logs.length > 0) {
          // Write to database
          for (const log of logs) {
            const { from, to, tokenId } = log.args;
            const id = `${log.transactionHash}:${log.logIndex}`;
            
            await db.query(
              `INSERT INTO "PositionTransfer" (id, "tokenId", "from", "to", "blockNumber", "txHash", "logIndex", timestamp, "nfpmAddress")
               VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8)
               ON CONFLICT (id) DO NOTHING`,
              [id, tokenId.toString(), from.toLowerCase(), to.toLowerCase(), Number(log.blockNumber), log.transactionHash, Number(log.logIndex), SPARKDEX_NFPM.toLowerCase()]
            );
          }

          totalEvents += logs.length;
          console.log(`✓ ${current}→${end}: ${logs.length} events (total: ${totalEvents})`);
        }

        current = end + 1;
        await new Promise(r => setTimeout(r, 100)); // Rate limit
      } catch (err) {
        console.error(`✗ Error ${current}→${end}:`, err.message);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    console.log(`\n✅ Done! Total events: ${totalEvents}`);
    
  } finally {
    await db.end();
  }
}

main().catch(console.error);

