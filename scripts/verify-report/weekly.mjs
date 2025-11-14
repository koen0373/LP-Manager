#!/usr/bin/env node

/**
 * Weekly Report Verifier
 * 
 * Runs the weekly report generator in test mode and verifies output.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const execAsync = promisify(exec);

async function main() {
  console.log('[verify-report] Running weekly report generator...\n');

  try {
    const { stdout, stderr } = await execAsync(
      'node scripts/reports/weekly-liquidity-pool-report.mjs --week auto',
      { cwd: ROOT, maxBuffer: 10 * 1024 * 1024 }
    );

    if (stderr) {
      console.warn('[verify-report] stderr:', stderr);
    }

    console.log('[verify-report] Generator output:');
    console.log(stdout);

    // Find the report directory (last completed week)
    const reportsDir = path.join(ROOT, 'data', 'reports');
    const dirs = await fs.readdir(reportsDir).catch(() => []);
    const weekDirs = dirs.filter((d) => /^\d{4}-W\d{2}$/.test(d)).sort().reverse();

    if (weekDirs.length === 0) {
      console.error('[verify-report] ❌ No report directories found');
      process.exit(1);
    }

    const latestWeek = weekDirs[0];
    const reportDir = path.join(reportsDir, latestWeek);

    console.log(`\n[verify-report] Checking report directory: ${latestWeek}`);

    const requiredFiles = ['report.md', 'top-pools.csv', 'top-wallets.csv', 'pool-changes.csv'];
    const missing = [];

    for (const file of requiredFiles) {
      const filePath = path.join(reportDir, file);
      try {
        const stats = await fs.stat(filePath);
        if (stats.size === 0) {
          missing.push(`${file} (empty)`);
        } else {
          console.log(`[verify-report] ✓ ${file} (${stats.size} bytes)`);
        }
      } catch {
        missing.push(file);
      }
    }

    if (missing.length > 0) {
      console.error(`[verify-report] ❌ Missing or empty files: ${missing.join(', ')}`);
      process.exit(1);
    }

    // Basic sanity check: read report.md and check for content
    const reportMd = await fs.readFile(path.join(reportDir, 'report.md'), 'utf8');
    if (reportMd.length < 100) {
      console.error('[verify-report] ❌ report.md seems too short');
      process.exit(1);
    }

    console.log('\n[verify-report] ✅ All checks passed');
    process.exit(0);
  } catch (error) {
    console.error('[verify-report] ❌ Error:', error);
    process.exit(1);
  }
}

main();


