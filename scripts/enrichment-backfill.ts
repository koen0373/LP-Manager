#!/usr/bin/env tsx
/**
 * Enrichment Backfill Script - Optimized for Speed
 * 
 * Runs all enrichment scripts with large batches to quickly enrich existing data.
 * Uses optimized batch sizes and concurrency to minimize total time.
 * 
 * Estimated total time: ~15-20 hours (with parallel processing)
 * 
 * Usage:
 *   npx tsx scripts/enrichment-backfill.ts
 * 
 * Or run individual scripts with larger limits:
 *   npm run enrich:data -- --limit=5000 --skip-fees
 *   npm run enrich:data -- --limit=20000 --skip-pool
 */

import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ScriptConfig {
  name: string;
  command: string;
  timeout: number; // milliseconds
  estimatedTime: string; // human readable
  priority: 'high' | 'medium' | 'low';
}

const SCRIPTS: ScriptConfig[] = [
  {
    name: 'APR Calculation',
    command: 'npx tsx scripts/enrich-apr-calculation.ts --limit=500',
    timeout: 300000, // 5 min
    estimatedTime: '~5 min',
    priority: 'high', // Fast, SQL only
  },
  {
    name: 'Pool Volume',
    command: 'npx tsx scripts/enrich-pool-volume.ts --limit=500',
    timeout: 300000, // 5 min
    estimatedTime: '~5 min',
    priority: 'high', // Fast, SQL only
  },
  {
    name: 'Position Health',
    command: 'npx tsx scripts/enrich-position-health.ts --limit=10000',
    timeout: 600000, // 10 min
    estimatedTime: '~10 min',
    priority: 'high', // Fast, SQL only
  },
  {
    name: 'Pool Attribution',
    command: 'npx tsx scripts/enrich-user-engagement-data.ts --skip-fees --limit=5000 --concurrency=12',
    timeout: 1800000, // 30 min per batch
    estimatedTime: '~7 uur (5 batches van 5K)',
    priority: 'high', // Critical for other enrichments
  },
  {
    name: 'Fees USD Calculation',
    command: 'npx tsx scripts/enrich-user-engagement-data.ts --skip-pool --limit=20000 --concurrency=12',
    timeout: 2400000, // 40 min per batch
    estimatedTime: '~6 uur (6 batches van 20K)',
    priority: 'high', // Critical for reports
  },
  {
    name: 'Range Status',
    command: 'npx tsx scripts/enrich-range-status.ts --limit=5000 --concurrency=12',
    timeout: 1800000, // 30 min per batch
    estimatedTime: '~14 uur (5 batches van 5K)',
    priority: 'medium', // Important but slower
  },
  {
    name: 'Impermanent Loss',
    command: 'npx tsx scripts/enrich-impermanent-loss.ts --limit=5000 --concurrency=12',
    timeout: 1800000, // 30 min per batch
    estimatedTime: '~6 uur (2 batches van 5K)',
    priority: 'medium',
  },
  {
    name: 'rFLR Vesting',
    command: 'npx tsx scripts/enrich-rflr-vesting.ts --limit=5000 --concurrency=10',
    timeout: 3600000, // 60 min per batch
    estimatedTime: '~11 uur (2 batches van 5K)',
    priority: 'medium', // API rate limiting
  },
  {
    name: 'Unclaimed Fees',
    command: 'npx tsx scripts/enrich-unclaimed-fees.ts --limit=5000 --concurrency=10',
    timeout: 3600000, // 60 min per batch
    estimatedTime: '~11 uur (2 batches van 5K)',
    priority: 'low', // Can be done later
  },
  {
    name: 'Position Snapshots',
    command: 'npx tsx scripts/enrich-position-snapshots.ts --limit=5000 --concurrency=10',
    timeout: 3600000, // 60 min per batch
    estimatedTime: '~11 uur (2 batches van 5K)',
    priority: 'low', // Nice to have
  },
];

async function runBackfill() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 ENRICHMENT BACKFILL - Large Batch Processing');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📅 Started: ${new Date().toISOString()}\n`);

  // Sort by priority
  const sortedScripts = [...SCRIPTS].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  console.log('📋 Execution Plan:');
  sortedScripts.forEach((script, idx) => {
    const priorityEmoji = script.priority === 'high' ? '🔴' : script.priority === 'medium' ? '🟡' : '🟢';
    console.log(`   ${idx + 1}. ${priorityEmoji} ${script.name} (${script.estimatedTime})`);
  });

  console.log('\n⏱️  Estimated Total Time: ~15-20 hours (with parallel processing)\n');
  console.log('💡 Tip: You can run scripts individually with larger limits if needed.\n');

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
    
    console.log(`\n${priorityEmoji} Running: ${script.name}...`);
    console.log(`   Command: ${script.command}`);
    console.log(`   Estimated: ${script.estimatedTime}`);
    
    try {
      const { stdout, stderr } = await execAsync(script.command, {
        timeout: script.timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
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
  console.log('📊 BACKFILL SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalTime = results.reduce((sum, r) => sum + r.elapsed, 0);

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
        console.log(`   npm run enrich:... -- --limit=... # ${r.name}`);
      }
    });
    console.log('\n💡 Failed scripts can be re-run without affecting successful ones.\n');
  } else {
    console.log('\n✅ Backfill complete! All existing data enriched.');
    console.log('💡 Hourly cron job will now maintain enrichment for new data.\n');
  }
}

runBackfill()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

/**
 * Enrichment Backfill Script
 * 
 * Runs all enrichment scripts with large batches to quickly enrich existing data.
 * This is a one-time operation to catch up on all existing records.
 * 
 * After this backfill, the hourly cron job will maintain enrichment for new data.
 * 
 * Usage:
 *   npx tsx scripts/enrichment-backfill.ts
 */

import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SCRIPTS = [
  {
    name: 'Pool Attribution',
    command: 'npx tsx scripts/enrich-user-engagement-data.ts --skip-fees --limit=5000 --concurrency=10',
    timeout: 600000, // 10 min
  },
  {
    name: 'Fees USD Calculation',
    command: 'npx tsx scripts/enrich-user-engagement-data.ts --skip-pool --limit=20000 --concurrency=12',
    timeout: 1200000, // 20 min (met rate limiting)
  },
  {
    name: 'Range Status',
    command: 'npx tsx scripts/enrich-range-status.ts --limit=5000 --concurrency=10',
    timeout: 900000, // 15 min
  },
  {
    name: 'Position Snapshots',
    command: 'npx tsx scripts/enrich-position-snapshots.ts --limit=2000 --concurrency=10',
    timeout: 600000, // 10 min
  },
  {
    name: 'APR Calculation',
    command: 'npx tsx scripts/enrich-apr-calculation.ts --limit=500',
    timeout: 300000, // 5 min
  },
  {
    name: 'Impermanent Loss',
    command: 'npx tsx scripts/enrich-impermanent-loss.ts --limit=5000 --concurrency=10',
    timeout: 900000, // 15 min
  },
  {
    name: 'rFLR Vesting',
    command: 'npx tsx scripts/enrich-rflr-vesting.ts --limit=5000 --concurrency=10',
    timeout: 900000, // 15 min
  },
  {
    name: 'Unclaimed Fees',
    command: 'npx tsx scripts/enrich-unclaimed-fees.ts --limit=2000 --concurrency=10',
    timeout: 600000, // 10 min
  },
  {
    name: 'Position Health',
    command: 'npx tsx scripts/enrich-position-health.ts --limit=5000',
    timeout: 600000, // 10 min
  },
  {
    name: 'Pool Volume',
    command: 'npx tsx scripts/enrich-pool-volume.ts --limit=200',
    timeout: 300000, // 5 min
  },
];

async function runBackfill() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 ENRICHMENT BACKFILL - Large Batch Processing');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📅 Started: ${new Date().toISOString()}\n`);

  const results: Array<{
    name: string;
    success: boolean;
    elapsed: number;
    error?: string;
  }> = [];

  const startTime = Date.now();

  for (const script of SCRIPTS) {
    const scriptStart = Date.now();
    console.log(`\n📊 Running: ${script.name}...`);
    console.log(`   Command: ${script.command}`);
    
    try {
      const { stdout, stderr } = await execAsync(script.command, {
        timeout: script.timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      const elapsed = ((Date.now() - scriptStart) / 1000).toFixed(1);
      
      if (stderr && !stderr.includes('Warning')) {
        console.warn(`⚠️  ${script.name} warnings:`, stderr);
      }

      // Extract key metrics from output
      const lines = stdout.split('\n');
      const summaryLines = lines.filter(line => 
        line.includes('✅') || 
        line.includes('Processed:') || 
        line.includes('Updated:') ||
        line.includes('Calculated:')
      );
      
      if (summaryLines.length > 0) {
        console.log(`   Summary:`);
        summaryLines.slice(0, 5).forEach(line => console.log(`     ${line.trim()}`));
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
      
      console.error(`❌ ${script.name} failed after ${elapsed}s:`, msg);
      results.push({
        name: script.name,
        success: false,
        elapsed: parseFloat(elapsed),
        error: msg,
      });
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 BACKFILL SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalTime = results.reduce((sum, r) => sum + r.elapsed, 0);

  console.log(`⏱️  Total time: ${totalElapsed}s (${(parseFloat(totalElapsed) / 60).toFixed(1)} min)\n`);
  console.log(`✅ Successful: ${successful}/${SCRIPTS.length}`);
  console.log(`❌ Failed: ${failed}/${SCRIPTS.length}\n`);

  console.log('📋 Results per script:');
  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    const time = r.elapsed.toFixed(1);
    console.log(`   ${status} ${r.name}: ${time}s${r.error ? ` (${r.error.substring(0, 50)}...)` : ''}`);
  });

  if (failed > 0) {
    console.log('\n⚠️  Some scripts failed. Check logs above for details.');
    process.exit(1);
  }

  console.log('\n✅ Backfill complete! All existing data enriched.');
  console.log('💡 Hourly cron job will now maintain enrichment for new data.\n');
}

runBackfill()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

