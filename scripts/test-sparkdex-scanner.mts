/**
 * Quick test: SparkDEX TokenDistributor events
 * Tests last 10,000 blocks for reward events
 */

import { StakingScanner } from '../src/indexer/stakingScanner';
import { createPublicClient, http } from 'viem';
import { flare } from 'viem/chains';

const FLARE_RPC = process.env.FLARE_RPC_URL || 'https://flare-api.flare.network/ext/bc/C/rpc';

// SparkDEX contracts (inline for .mts compatibility)
const SPARKDEX_CONTRACTS = [
  {
    address: '0xc2DF11C68f86910B99EAf8acEd7F5189915Ba24F',
    dex: 'sparkdex-v3' as const,
    type: 'custom' as const,
    rewardToken: '0x657097cC15fdEc9e383dB8628B57eA4a763F2ba0',
    rewardTokenSymbol: 'SPX',
    startBlock: 29_837_200,
  },
  {
    address: '0xc2DF11C68f86910B99EAf8acEd7F5189915Ba24F',
    dex: 'sparkdex-v3' as const,
    type: 'custom' as const,
    rewardToken: '0x0000000000000000000000000000000000000000',
    rewardTokenSymbol: 'rFLR',
    startBlock: 29_837_200,
  },
];

async function main() {
  console.log('[Test] SparkDEX TokenDistributor scan...\n');

  // Get current block
  const client = createPublicClient({
    chain: flare,
    transport: http(FLARE_RPC),
  });

  const latestBlock = await client.getBlockNumber();
  const toBlock = Number(latestBlock);
  const fromBlock = toBlock - 10_000; // Last 10K blocks (~8-12 hours)

  console.log(`[Test] Latest block: ${toBlock}`);
  console.log(`[Test] Scanning range: ${fromBlock} → ${toBlock}\n`);

  console.log(`[Test] Found ${SPARKDEX_CONTRACTS.length} SparkDEX staking contracts\n`);

  for (const config of SPARKDEX_CONTRACTS) {
    console.log(`[Test] Scanning: ${config.rewardTokenSymbol} (${config.address})`);
    
    const scanner = new StakingScanner(FLARE_RPC, config);
    
    try {
      const events = await scanner.scan(fromBlock, toBlock);
      
      console.log(`[Test] ✓ Found ${events.length} events`);
      
      if (events.length > 0) {
        console.log(`[Test] Sample events:`);
        events.slice(0, 3).forEach((e) => {
          console.log(`  - ${e.eventName}: ${e.amount || 'N/A'} (block ${e.blockNumber})`);
        });
      }
      
      console.log('');
    } catch (err) {
      console.error(`[Test] ✗ Error:`, err);
    }
  }

  console.log('[Test] Done!');
}

main()
  .catch((err) => {
    console.error('[Test] Fatal error:', err);
    process.exit(1);
  });

