#!/usr/bin/env tsx
// Backfill pool Swap events for price history

import { syncPoolSwaps } from '../src/lib/sync/syncPoolSwaps';
import { getPositionById } from '../src/services/pmFallback';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npm run backfill:swaps <tokenId> [--verbose]');
    console.error('Example: npm run backfill:swaps 22003 --verbose');
    process.exit(1);
  }

  const tokenId = args[0];
  const verbose = args.includes('--verbose');

  console.log(`\n🔄 Backfilling Swap events for position ${tokenId}...\n`);

  try {
    // Get position to find pool address
    console.log(`Fetching position ${tokenId}...`);
    const position = await getPositionById(tokenId);
    
    if (!position) {
      console.error(`❌ Position ${tokenId} not found`);
      process.exit(1);
    }

    const poolAddress = position.poolAddress;
    console.log(`Pool address: ${poolAddress}`);
    console.log(`Pool: ${position.token0.symbol}/${position.token1.symbol}\n`);

    // Sync swaps
    const result = await syncPoolSwaps(poolAddress, { verbose });

    if (result.success) {
      console.log('\n' + '='.repeat(60));
      console.log(`✅ Success! Pool ${poolAddress.slice(0, 10)}... synced`);
      console.log(`   - Swaps ingested: ${result.swapsIngested}`);
      console.log('='.repeat(60));
    } else {
      console.error('\n' + '='.repeat(60));
      console.error(`❌ Failed to sync pool swaps`);
      console.error(`   Error: ${result.error}`);
      console.error('='.repeat(60));
      process.exit(1);
    }

    console.log('\n✨ Swap backfill completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();

