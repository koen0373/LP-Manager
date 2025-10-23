#!/usr/bin/env tsx

import { syncPositionLedger, syncMultiplePositions } from '../src/lib/sync/syncPositionLedger';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage:
  npm run backfill <tokenId> [tokenId2 tokenId3 ...]
  npm run backfill -- --all
  npm run backfill -- --help

Examples:
  npm run backfill 22003
  npm run backfill 22003 22326 20445
  npm run backfill -- --all

Options:
  --help      Show this help message
  --all       Sync all positions (use with caution)
  --verbose   Enable verbose logging
    `);
    process.exit(0);
  }

  const verbose = args.includes('--verbose');
  const tokenIds = args.filter(arg => !arg.startsWith('--') && !isNaN(Number(arg)));

  if (args.includes('--all')) {
    console.log('⚠️  --all flag is not yet implemented');
    console.log('Please specify token IDs manually for now');
    process.exit(1);
  }

  if (tokenIds.length === 0) {
    console.error('❌ No valid token IDs provided');
    process.exit(1);
  }

  console.log(`\n🔄 Starting ledger backfill for ${tokenIds.length} position(s)\n`);

  if (tokenIds.length === 1) {
    // Single position sync with detailed output
    const tokenId = tokenIds[0];
    console.log(`Syncing position ${tokenId}...`);
    
    const result = await syncPositionLedger(tokenId, { verbose: true });

    console.log('\n' + '='.repeat(60));
    if (result.success) {
      console.log(`✅ Success! Position ${tokenId} synced`);
      console.log(`   - Events ingested: ${result.eventsIngested}`);
      console.log(`   - Transfers ingested: ${result.transfersIngested}`);
    } else {
      console.log(`❌ Failed to sync position ${tokenId}`);
      console.log(`   Error: ${result.error}`);
      process.exit(1);
    }
    console.log('='.repeat(60) + '\n');
  } else {
    // Multiple positions sync with summary
    const result = await syncMultiplePositions(tokenIds, { verbose });

    console.log('\n' + '='.repeat(60));
    console.log(`📊 Batch Sync Summary`);
    console.log('='.repeat(60));
    console.log(`Total positions: ${result.total}`);
    console.log(`✅ Successful: ${result.successful}`);
    console.log(`❌ Failed: ${result.failed}`);
    console.log('');

    // Show detailed results
    for (const res of result.results) {
      if (res.success) {
        console.log(
          `✅ Position ${res.tokenId}: ` +
          `${res.eventsIngested} events, ${res.transfersIngested} transfers`
        );
      } else {
        console.log(`❌ Position ${res.tokenId}: ${res.error}`);
      }
    }
    console.log('='.repeat(60) + '\n');

    if (result.failed > 0) {
      process.exit(1);
    }
  }

  console.log('✨ Ledger backfill completed successfully!\n');
}

main().catch((error) => {
  console.error('\n❌ Fatal error during backfill:');
  console.error(error);
  process.exit(1);
});
