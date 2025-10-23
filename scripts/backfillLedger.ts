#!/usr/bin/env node
/**
 * Backfill script for LP Manager
 * 
 * Usage:
 *   npm run backfill:run                  # Interactive mode (not implemented yet)
 *   npm run backfill:ids 22003 22326 ...  # Backfill specific tokenIds
 *   npm run backfill:ids -- --full        # Full re-sync (ignore cursor)
 * 
 * Environment:
 *   DATABASE_URL - Postgres connection string
 *   FLARESCAN_API_BASE - Flarescan API base URL
 *   RPC_URL_FALLBACK - RPC endpoint for block numbers
 */

import { backfillPositions } from '../src/lib/backfill/worker';
import { getLpPositionsOnChain } from '../src/services/pmFallback';

// Parse CLI arguments
const args = process.argv.slice(2);

// Check for flags
const fullMode = args.includes('--full');
const sinceBlockArg = args.find(a => a.startsWith('--since='));
const sinceBlock = sinceBlockArg ? parseInt(sinceBlockArg.split('=')[1]) : undefined;

// Check for wallet address (starts with 0x)
const walletAddress = args.find(arg => arg.startsWith('0x'));

// Extract tokenIds (numeric arguments)
let tokenIds = args
  .filter(arg => !arg.startsWith('--') && !arg.startsWith('0x'))
  .map(arg => parseInt(arg, 10))
  .filter(id => !isNaN(id));

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║           LP MANAGER - BACKFILL WORKER                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // If wallet address provided, fetch all tokenIds
  if (walletAddress) {
    console.log(`🔍 Fetching all positions for wallet: ${walletAddress}\n`);
    try {
      const positions = await getLpPositionsOnChain(walletAddress as `0x${string}`);
      tokenIds = positions.map(p => parseInt(p.id.toString(), 10)).filter(id => !isNaN(id));
      console.log(`✅ Found ${tokenIds.length} positions: ${tokenIds.join(', ')}\n`);
    } catch (error: any) {
      console.error(`❌ Failed to fetch positions for wallet: ${error.message}`);
      process.exit(1);
    }
  }

  if (tokenIds.length === 0) {
    console.error('❌ No tokenIds provided or found');
    console.log('\nUsage:');
    console.log('  node ./dist/scripts/backfillLedger.js 22003 22326 20445 21866');
    console.log('  node ./dist/scripts/backfillLedger.js 0xYourWalletAddress');
    console.log('  node ./dist/scripts/backfillLedger.js 22003 --full');
    console.log('  node ./dist/scripts/backfillLedger.js 0xYourWallet --full');
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log(`  Token IDs: ${tokenIds.join(', ')}`);
  console.log(`  Mode: ${fullMode ? 'FULL' : 'SINCE LAST CHECKPOINT'}`);
  if (sinceBlock) {
    console.log(`  Since Block: ${sinceBlock}`);
  }
  console.log(`  Concurrency: 6`);
  console.log();

  try {
    const summary = await backfillPositions({
      tokenIds,
      mode: fullMode ? 'full' : 'since',
      sinceBlock,
      concurrency: 6,
    });

    if (summary.failed > 0) {
      console.error('\n⚠️  Some positions failed to backfill');
      process.exit(1);
    }

    console.log('\n✅ Backfill completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Backfill failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run main and handle unhandled rejections
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
