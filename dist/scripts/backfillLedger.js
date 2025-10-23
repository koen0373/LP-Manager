#!/usr/bin/env node
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const worker_1 = require("../src/lib/backfill/worker");
// Parse CLI arguments
const args = process.argv.slice(2);
// Check for flags
const fullMode = args.includes('--full');
const sinceBlockArg = args.find(a => a.startsWith('--since='));
const sinceBlock = sinceBlockArg ? parseInt(sinceBlockArg.split('=')[1]) : undefined;
// Extract tokenIds (numeric arguments)
const tokenIds = args
    .filter(arg => !arg.startsWith('--'))
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
    if (tokenIds.length === 0) {
        console.error('❌ No tokenIds provided');
        console.log('\nUsage:');
        console.log('  node --loader tsx ./scripts/backfillLedger.ts 22003 22326 20445 21866');
        console.log('  node --loader tsx ./scripts/backfillLedger.ts 22003 --full');
        console.log('  node --loader tsx ./scripts/backfillLedger.ts 22003 --since=1000000');
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
        const summary = await (0, worker_1.backfillPositions)({
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
    }
    catch (error) {
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
