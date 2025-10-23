#!/usr/bin/env tsx

/**
 * Indexer Backfill Script
 * 
 * Usage:
 *   npm run indexer:backfill              # Backfill all from genesis
 *   npm run indexer:backfill 22003        # Backfill specific tokenId
 *   npm run indexer:backfill 22003 22326  # Backfill multiple tokenIds
 *   npm run indexer:backfill --dry        # Dry run (no writes)
 * 
 * This script backfills historical blockchain data for LP positions.
 * It can run globally or for specific tokenIds, and resumes from checkpoints.
 */

import { IndexerCore } from '../src/indexer/indexerCore';
import { indexerConfig } from '../indexer.config';

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const dryRun = args.includes('--dry') || args.includes('--dry-run');
  const tokenIds = args.filter((arg) => !arg.startsWith('--') && /^\d+$/.test(arg));

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         LIQUI BLOCKCHAIN INDEXER - BACKFILL MODE              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No data will be written');
    console.log('');
  }

  const indexer = new IndexerCore();

  try {
    if (tokenIds.length > 0) {
      // Backfill specific tokenIds
      console.log(`🎯 Backfilling ${tokenIds.length} tokenId(s): ${tokenIds.join(', ')}`);
      console.log('');

      for (const tokenId of tokenIds) {
        const checkpointKey = `tokenId:${tokenId}`;

        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🔄 Backfilling tokenId: ${tokenId}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log('');

        const result = await indexer.index({
          tokenIds: [tokenId],
          checkpointKey,
          dryRun,
        });

        console.log('');
        console.log(`✅ TokenId ${tokenId} complete:`);
        console.log(`   - Blocks scanned: ${result.blocksScanned.toLocaleString()}`);
        console.log(`   - Events found: ${result.eventsDecoded.toLocaleString()}`);
        console.log(`   - Events written: ${result.eventsWritten.toLocaleString()}`);
        console.log(`   - Duplicates skipped: ${result.duplicates.toLocaleString()}`);
        console.log(`   - Time: ${Math.round(result.elapsedMs / 1000)}s`);
        console.log('');
      }
    } else {
      // Global backfill
      console.log('🌍 Backfilling ALL events (global)');
      console.log(`   Start block: ${indexerConfig.contracts.startBlock.toLocaleString()}`);
      console.log('');

      // Check current status
      const status = await indexer.getStatus('global');
      console.log('📊 Current status:');
      console.log(`   - Last checkpoint: ${status.checkpoint?.toLocaleString() ?? 'none'}`);
      console.log(`   - Latest block: ${status.latestBlock.toLocaleString()}`);
      console.log(`   - Blocks behind: ${status.blocksBehind.toLocaleString()}`);
      console.log(`   - Events synced: ${status.eventsCount.toLocaleString()}`);
      console.log('');

      if (status.blocksBehind === 0) {
        console.log('✅ Already up to date!');
        return;
      }

      console.log(`🚀 Starting backfill...`);
      console.log('');

      const result = await indexer.index({
        checkpointKey: 'global',
        dryRun,
      });

      console.log('');
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║                    BACKFILL COMPLETE                          ║');
      console.log('╚════════════════════════════════════════════════════════════════╝');
      console.log('');
      console.log(`   📦 Blocks scanned: ${result.blocksScanned.toLocaleString()}`);
      console.log(`   📝 Logs found: ${result.logsFound.toLocaleString()}`);
      console.log(`   ✅ Events decoded: ${result.eventsDecoded.toLocaleString()}`);
      console.log(`   💾 Events written: ${result.eventsWritten.toLocaleString()}`);
      console.log(`   ⏭️  Duplicates skipped: ${result.duplicates.toLocaleString()}`);
      console.log(`   ⏱️  Time elapsed: ${Math.round(result.elapsedMs / 1000)}s`);
      console.log(`   ⚡ Performance: ${Math.round(result.blocksScanned / (result.elapsedMs / 1000))} blocks/s`);
      console.log('');
    }
  } catch (error) {
    console.error('');
    console.error('❌ BACKFILL FAILED:');
    console.error(error);
    console.error('');
    process.exit(1);
  } finally {
    await indexer.close();
  }

  console.log('✨ Done!');
  console.log('');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

