/**
 * Indexer Backfill Script — Extended with Staking Stream
 * 
 * Usage:
 *   npm run indexer:backfill -- --stream=staking
 */

import { StakingScanner } from '../src/indexer/stakingScanner';
import { STAKING_CONTRACTS } from '../src/indexer/config/stakingContracts';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FLARE_RPC = process.env.FLARE_RPC_URL || 'https://flare-api.flare.network/ext/bc/C/rpc';
const BLOCK_WINDOW = Number(process.env.INDEXER_BLOCK_WINDOW) || 1000;
const START_BLOCK = 29_837_200; // Genesis block for Enosys/SparkDEX

async function indexStakingStream(fromBlock?: number, toBlock?: number) {
  console.log('[Indexer] Starting STAKING stream...');

  if (STAKING_CONTRACTS.length === 0) {
    console.warn('[Indexer] No staking contracts configured. Update src/indexer/config/stakingContracts.ts');
    return;
  }

  // Get latest block if not specified
  if (!toBlock) {
    const latestBlock = await prisma.stakingEvent.findFirst({
      orderBy: { blockNumber: 'desc' },
      select: { blockNumber: true },
    });
    toBlock = latestBlock?.blockNumber || START_BLOCK;
  }

  if (!fromBlock) {
    fromBlock = toBlock;
  }

  console.log(`[Indexer] Scanning staking contracts from block ${fromBlock} → ${toBlock}`);

  // Scan each staking contract
  for (const config of STAKING_CONTRACTS) {
    console.log(`[Indexer] Scanning ${config.dex} staking (${config.address})...`);

    const scanner = new StakingScanner(FLARE_RPC, config);

    let currentBlock = fromBlock;
    while (currentBlock < toBlock) {
      const windowEnd = Math.min(currentBlock + BLOCK_WINDOW, toBlock);

      try {
        const events = await scanner.scan(currentBlock, windowEnd);

        // Write to DB
        if (events.length > 0) {
          await prisma.stakingEvent.createMany({
            data: events.map((e) => ({
              id: e.id,
              stakingContract: e.stakingContract,
              poolAddress: e.poolAddress,
              eventName: e.eventName,
              userAddress: e.userAddress,
              rewardToken: e.rewardToken,
              amount: e.amount,
              blockNumber: e.blockNumber,
              txHash: e.txHash,
              logIndex: e.logIndex,
              timestamp: e.timestamp,
              metadata: e.metadata,
            })),
            skipDuplicates: true,
          });

          console.log(
            `[Indexer] ✓ ${config.dex} ${currentBlock}→${windowEnd}: ${events.length} events written`
          );
        }
      } catch (err) {
        console.error(`[Indexer] Error scanning ${currentBlock}→${windowEnd}:`, err);
        // Continue on error (resilient)
      }

      currentBlock = windowEnd + 1;
      await new Promise((r) => setTimeout(r, 100)); // Rate limit
    }
  }

  console.log('[Indexer] STAKING stream complete!');
}

// CLI
const args = process.argv.slice(2);
const stream = args.find((a) => a.startsWith('--stream='))?.split('=')[1];

if (stream === 'staking') {
  indexStakingStream()
    .catch((err) => {
      console.error('[Indexer] Fatal error:', err);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
} else {
  console.log('[Indexer] Usage: npm run indexer:backfill -- --stream=staking');
}

