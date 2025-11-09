/**
 * Direct test: SparkDEX TokenDistributor events
 * Bypasses scanner class, uses viem directly
 */

import { createPublicClient, http } from 'viem';
import { flare } from 'viem/chains';

const FLARE_RPC = process.env.FLARE_RPC_URL || 'https://flare-api.flare.network/ext/bc/C/rpc';
const TOKEN_DISTRIBUTOR = '0xc2DF11C68f86910B99EAf8acEd7F5189915Ba24F';

// TokenDistributor events - Try all possible event signatures
const TOKEN_DISTRIBUTOR_ABI = [
  // Standard ERC20 Transfer (rewards paid out)
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const;

async function main() {
  console.log('[Test] SparkDEX TokenDistributor direct scan...\n');

  const client = createPublicClient({
    chain: flare,
    transport: http(FLARE_RPC),
  });

  const latestBlock = await client.getBlockNumber();
  const toBlock = Number(latestBlock);
  const fromBlock = toBlock - 25; // Last 25 blocks (Flare limit = 30)

  console.log(`[Test] Latest block: ${toBlock}`);
  console.log(`[Test] Scanning: ${fromBlock} → ${toBlock} (25 blocks)`);
  console.log(`[Test] Contract: ${TOKEN_DISTRIBUTOR}\n`);

  try {
    const logs = await client.getLogs({
      address: TOKEN_DISTRIBUTOR as `0x${string}`,
      events: TOKEN_DISTRIBUTOR_ABI,
      fromBlock: BigInt(fromBlock),
      toBlock: BigInt(toBlock),
    });

    console.log(`[Test] ✓ Found ${logs.length} reward events\n`);

    if (logs.length > 0) {
      console.log('[Test] Sample events:');
      logs.slice(0, 5).forEach((log) => {
        console.log(`  - Block ${log.blockNumber}: ${log.eventName}`);
        console.log(`    Args:`, log.args);
      });
    } else {
      console.log('[Test] No events found in this range.');
      console.log('[Test] TokenDistributor might be inactive or use different event names.');
    }
  } catch (err: any) {
    console.error('[Test] ✗ Error:', err.message);
  }

  console.log('\n[Test] Done!');
}

main().catch((err) => {
  console.error('[Test] Fatal:', err);
  process.exit(1);
});

