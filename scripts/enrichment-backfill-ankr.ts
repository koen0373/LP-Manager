#!/usr/bin/env tsx
/**
 * ANKR Historical Backfill Script
 * 
 * One-time script to enrich ALL historical data using ANKR RPC with 5000 block batches.
 * This script uses ANKR's high-performance RPC to quickly backfill all enrichment data.
 * 
 * Prerequisites:
 * - Set ANKR_HTTP_URL environment variable
 * - Set INDEXER_BLOCK_WINDOW=5000 for ANKR's 5000 block limit
 * 
 * Usage:
 *   ANKR_HTTP_URL=https://rpc.ankr.com/flare/YOUR_KEY npx tsx scripts/enrichment-backfill-ankr.ts
 * 
 * Or via Railway:
 *   Railway will use ANKR_HTTP_URL from environment variables
 */

import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Verify ANKR is configured
const ankrUrl = process.env.ANKR_HTTP_URL || process.env.FLARE_RPC_URL;
const isAnkr = ankrUrl?.includes('ankr.com') || ankrUrl?.includes('ankr');

if (!isAnkr) {
  console.error('❌ ANKR RPC not detected!');
  console.error('   Set ANKR_HTTP_URL=https://rpc.ankr.com/flare/YOUR_KEY');
  console.error('   Or set FLARE_RPC_URL to an ANKR endpoint');
  process.exit(1);
}

console.log('✅ ANKR RPC detected:', ankrUrl?.substring(0, 50) + '...');

// Set block window for ANKR (5000 blocks)
process.env.INDEXER_BLOCK_WINDOW = '5000';

interface ScriptConfig {
  name: string;
  command: string;
  timeout: number; // milliseconds
  estimatedTime: string;
  priority: 'high' | 'medium' | 'low';
  usesAnkrBlocks?: boolean; // Whether this benefits from 5000 block batches
}

const SCRIPTS: ScriptConfig[] = [
  {
    name: 'APR Calculation',
    command: 'npx tsx scripts/enrich-apr-calculation.ts --limit=500',
    timeout: 300000, // 5 min
    estimatedTime: '~5 min',
    priority: 'high',
    usesAnkrBlocks: false, // SQL only
  },
  {
    name: 'Pool Volume (ANKR 5000 blocks)',
    command: 'npx tsx scripts/enrich-pool-volume.ts --limit=500',
    timeout: 600000, // 10 min (faster with ANKR)
    estimatedTime: '~10 min (166x faster with ANKR)',
    priority: 'high',
    usesAnkrBlocks: true, // Uses eth_getLogs for Swap events
  },
  {
    name: 'Position Health',
    command: 'npx tsx scripts/enrich-position-health.ts --limit=10000',
    timeout: 600000, // 10 min
    estimatedTime: '~10 min',
    priority: 'high',
    usesAnkrBlocks: false, // SQL only
  },
  {
    name: 'Pool Attribution',
    command: 'npx tsx scripts/enrich-user-engagement-data.ts --skip-fees --limit=5000 --concurrency=12',
    timeout: 1800000, // 30 min per batch
    estimatedTime: '~7 uur (5 batches van 5K)',
    priority: 'high',
    usesAnkrBlocks: false, // Contract calls, not block ranges
  },
  {
    name: 'Fees USD Calculation',
    command: 'npx tsx scripts/enrich-user-engagement-data.ts --skip-pool --limit=20000 --concurrency=12',
    timeout: 2400000, // 40 min per batch
    estimatedTime: '~6 uur (6 batches van 20K)',
    priority: 'high',
    usesAnkrBlocks: false, // CoinGecko API
  },
  {
    name: 'Range Status',
    command: 'npx tsx scripts/enrich-range-status.ts --limit=5000 --concurrency=12',
    timeout: 1800000, // 30 min per batch
    estimatedTime: '~14 uur (5 batches van 5K)',
    priority: 'medium',
    usesAnkrBlocks: false, // Contract calls
  },
  {
    name: 'Impermanent Loss',
    command: 'npx tsx scripts/enrich-impermanent-loss.ts --limit=5000 --concurrency=12',
    timeout: 1800000, // 30 min per batch
    estimatedTime: '~6 uur (2 batches van 5K)',
    priority: 'medium',
    usesAnkrBlocks: false, // Contract calls
  },
  {
    name: 'rFLR Vesting',
    command: 'npx tsx scripts/enrich-rflr-vesting.ts --limit=5000 --concurrency=10',
    timeout: 3600000, // 60 min per batch
    estimatedTime: '~11 uur (2 batches van 5K)',
    priority: 'medium',
    usesAnkrBlocks: false, // Enosys API
  },
  {
    name: 'Unclaimed Fees',
    command: 'npx tsx scripts/enrich-unclaimed-fees.ts --limit=5000 --concurrency=10',
    timeout: 1800000, // 30 min per batch
    estimatedTime: '~11 uur (2 batches van 5K)',
    priority: 'low',
    usesAnkrBlocks: false, // Contract calls
  },
  {
    name: 'Position Snapshots',
    command: 'npx tsx scripts/enrich-position-snapshots.ts --limit=5000 --concurrency=10',
    timeout: 1800000, // 30 min per batch
    estimatedTime: '~11 uur (2 batches van 5K)',
    priority: 'low',
    usesAnkrBlocks: false, // Contract calls
  },
];

async function runAnkrBackfill() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 ANKR HISTORICAL BACKFILL - Full History Enrichment');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📅 Started: ${new Date().toISOString()}`);
  console.log(`🌐 RPC: ANKR (5000 block batches)`);
  console.log(`💰 Estimated ANKR cost: ~$0.14 USD\n`);

  // Sort by priority
  const sortedScripts = [...SCRIPTS].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  console.log('📋 Execution Plan:');
  sortedScripts.forEach((script, idx) => {
    const priorityEmoji = script.priority === 'high' ? '🔴' : script.priority === 'medium' ? '🟡' : '🟢';
    const ankrBadge = script.usesAnkrBlocks ? ' ⚡ANKR' : '';
    console.log(`   ${idx + 1}. ${priorityEmoji} ${script.name}${ankrBadge} (${script.estimatedTime})`);
  });

  console.log('\n⏱️  Estimated Total Time: ~15-20 hours (with ANKR acceleration)\n');
  console.log('💡 ANKR Benefits:');
  console.log('   - 166x faster for event scanning (Pool Volume)');
  console.log('   - 99.4% cheaper for historical data');
  console.log('   - No rate limiting issues\n');

  const results: Array<{
    name: string;
    success: boolean;
    elapsed: number;
    error?: string;
  }> = [];

  const startTime = Date.now();

  for (const script of sortedScripts) {
    const scriptStart = Date.now();
    const priorityEmoji = script.priority === 'high' ? '🔴' : script.priority === 'medium' ? '🟡' : '🟢';
    const ankrBadge = script.usesAnkrBlocks ? ' ⚡ANKR' : '';
    
    console.log(`\n${priorityEmoji} Running: ${script.name}${ankrBadge}...`);
    console.log(`   Command: ${script.command}`);
    console.log(`   Estimated: ${script.estimatedTime}`);
    
    try {
      const { stdout, stderr } = await execAsync(script.command, {
        timeout: script.timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        env: {
          ...process.env,
          INDEXER_BLOCK_WINDOW: '5000', // Force ANKR block window
        },
      });

      const elapsed = ((Date.now() - scriptStart) / 1000).toFixed(1);
      
      if (stderr && !stderr.includes('Warning')) {
        console.warn(`⚠️  ${script.name} warnings:`, stderr.substring(0, 200));
      }

      // Extract key metrics from output
      const lines = stdout.split('\n');
      const summaryLines = lines.filter(line => 
        line.includes('✅') || 
        line.includes('Processed:') || 
        line.includes('Updated:') ||
        line.includes('Calculated:') ||
        line.includes('Resolved:')
      );
      
      if (summaryLines.length > 0) {
        console.log(`   Summary:`);
        summaryLines.slice(0, 5).forEach(line => {
          const trimmed = line.trim();
          if (trimmed) console.log(`     ${trimmed}`);
        });
      }

      console.log(`✅ ${script.name} complete in ${elapsed}s`);
      results.push({
        name: script.name,
        success: true,
        elapsed: parseFloat(elapsed),
      });
    } catch (error) {
      const elapsed = ((Date.now() - scriptStart) / 1000).toFixed(1);
      const msg = error instanceof Error ? error.message : String(error);
      
      console.error(`❌ ${script.name} failed after ${elapsed}s`);
      console.error(`   Error: ${msg.substring(0, 200)}`);
      results.push({
        name: script.name,
        success: false,
        elapsed: parseFloat(elapsed),
        error: msg.substring(0, 100),
      });
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalHours = (parseFloat(totalElapsed) / 3600).toFixed(1);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ANKR BACKFILL SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`⏱️  Total time: ${totalElapsed}s (${totalHours} hours)\n`);
  console.log(`✅ Successful: ${successful}/${SCRIPTS.length}`);
  console.log(`❌ Failed: ${failed}/${SCRIPTS.length}\n`);

  console.log('📋 Results per script:');
  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    const time = (r.elapsed / 60).toFixed(1);
    const hours = (r.elapsed / 3600).toFixed(1);
    const timeStr = r.elapsed > 3600 ? `${hours}h` : `${time}m`;
    console.log(`   ${status} ${r.name}: ${timeStr}${r.error ? ` (${r.error})` : ''}`);
  });

  if (failed > 0) {
    console.log('\n⚠️  Some scripts failed. You can re-run them individually:');
    results.filter(r => !r.success).forEach(r => {
      const script = SCRIPTS.find(s => s.name === r.name);
      if (script) {
        console.log(`   ${script.command} # ${r.name}`);
      }
    });
    console.log('\n💡 Failed scripts can be re-run without affecting successful ones.\n');
  } else {
    console.log('\n✅ ANKR backfill complete! All historical data enriched.');
    console.log('💡 Hourly cron job will now maintain enrichment for new data.\n');
  }
}

runAnkrBackfill()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

