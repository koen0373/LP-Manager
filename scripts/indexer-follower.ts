#!/usr/bin/env tsx

/**
 * Indexer Follower (Tail Mode)
 * 
 * Usage:
 *   npm run indexer:follow
 * 
 * This script runs continuously, syncing new blocks as they appear on the blockchain.
 * It resumes from the last checkpoint and polls for new blocks every N seconds.
 */

import { IndexerCore } from '../src/indexer/indexerCore';
import { indexerConfig } from '../indexer.config';

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         LIQUI BLOCKCHAIN INDEXER - FOLLOWER MODE              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📡 Following blockchain head...');
  console.log(`   Poll interval: ${indexerConfig.follower.pollIntervalMs / 1000}s`);
  console.log(`   Confirmation blocks: ${indexerConfig.follower.confirmationBlocks}`);
  console.log('');

  const indexer = new IndexerCore();
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('');
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    await indexer.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('');
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    await indexer.close();
    process.exit(0);
  });

  while (true) {
    try {
      // Get current status
      const status = await indexer.getStatus('global');

      if (status.blocksBehind > 0) {
        console.log(`[${new Date().toISOString()}] 🔄 Syncing ${status.blocksBehind} blocks behind...`);

        const result = await indexer.index({
          checkpointKey: 'global',
        });

        if (result.eventsDecoded > 0) {
          console.log(
            `[${new Date().toISOString()}] ✅ Synced ${result.blocksScanned} blocks, ${result.eventsDecoded} events in ${Math.round(result.elapsedMs / 1000)}s`
          );
        }

        // Reset error counter on success
        consecutiveErrors = 0;
      } else {
        console.log(`[${new Date().toISOString()}] ✓ Up to date at block ${status.checkpoint}`);
      }

      // Wait before next poll
      await sleep(indexerConfig.follower.pollIntervalMs);
    } catch (error) {
      consecutiveErrors++;
      console.error(`[${new Date().toISOString()}] ❌ Sync error (${consecutiveErrors}/${maxConsecutiveErrors}):`, error);

      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error('');
        console.error(`❌ Too many consecutive errors (${maxConsecutiveErrors}), exiting...`);
        await indexer.close();
        process.exit(1);
      }

      // Wait before retry
      const backoffMs = Math.min(indexerConfig.follower.restartDelayMs * consecutiveErrors, 30000);
      console.log(`⏳ Waiting ${backoffMs / 1000}s before retry...`);
      await sleep(backoffMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

