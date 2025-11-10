import type { NextApiRequest, NextApiResponse } from 'next';

type CronResponse = {
  success: boolean;
  timestamp: string;
  results: {
    poolAttribution?: { processed: number; resolved: number; skipped: number };
    feesUsd?: { calculated: number; failed: number };
    rangeStatus?: { processed: number; calculated: number; failed: number; inRange: number; outOfRange: number };
    positionSnapshots?: { processed: number; created: number; failed: number; inRange: number; outOfRange: number; totalTvl: number };
    aprCalculation?: { calculated: number; updated: number; failed: number; avgFeesApr: number; avgTotalApr: number };
    impermanentLoss?: { processed: number; calculated: number; failed: number; avgIL: number };
    rflrVesting?: { processed: number; updated: number; failed: number; totalRflr: number; totalVestedRflr: number };
    unclaimedFees?: { processed: number; updated: number; failed: number; totalUnclaimedUsd: number };
    positionHealth?: { processed: number; updated: number; failed: number; avgPctInRange: number };
    poolVolume?: { processed: number; updated: number; failed: number; totalSwaps: number };
  };
  errors?: string[];
  elapsed: string;
};

/**
 * Hourly Enrichment Cron Job
 * 
 * Runs enrichment processes every hour:
 * 1. Refresh Materialized Views (range status, position stats) - FAST, database-native
 * 2. Pool Attribution (500 positions/hour) - Complex, requires RPC calls
 * 3. Fees USD Calculation (5000 events/hour) - Complex, requires CoinGecko API
 * 4. Position Snapshots (100 positions/hour) - Complex, requires calculations
 * 5. APR Calculation (100 pools/hour) - Complex, requires multiple data sources
 * 6. Impermanent Loss (200 positions/hour) - Complex, requires calculations
 * 7. rFLR Vesting (200 positions/hour) - Complex, requires API calls
 * 8. Unclaimed Fees Tracking (100 positions/hour) - Complex, requires RPC calls
 * 9. Position Health Metrics (200 positions/hour) - Complex, requires calculations
 * 10. Pool Volume Metrics (50 pools/hour) - Complex, requires aggregations
 * 
 * Note: Range Status is now handled via materialized view (mv_position_range_status)
 * which is refreshed in step 1. This is much faster than the previous script-based approach.
 * 
 * Protected by CRON_SECRET environment variable
 * 
 * Usage:
 * - Railway: Set up cron job to call this endpoint hourly
 *   Example: curl -X POST https://your-app.railway.app/api/cron/enrichment-hourly \
 *            -H "Authorization: Bearer $CRON_SECRET"
 * - Manual: POST /api/cron/enrichment-hourly with Authorization header
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CronResponse | { error: string }>,
) {
  // Verify cron secret (Railway or manual)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET environment variable not set' });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized. Set CRON_SECRET env var and use Authorization: Bearer header.' });
  }

  const startTime = Date.now();
  const errors: string[] = [];
  const results: CronResponse['results'] = {};

  console.log('[CRON] Hourly enrichment started at', new Date().toISOString());

  // Import scripts dynamically to avoid loading issues
  try {
    // 1. Pool Attribution (500 positions/hour)
    try {
      console.log('[CRON] Running pool attribution (500 positions)...');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout: poolOutput } = await execAsync(
        `npx tsx scripts/enrich-user-engagement-data.ts --skip-fees --limit=500 --concurrency=10`,
        { timeout: 300000, maxBuffer: 10 * 1024 * 1024 } // 5 min timeout, 10MB buffer
      );
      
      // Parse output
      const resolvedMatch = poolOutput.match(/Resolved: (\d+)/);
      const skippedMatch = poolOutput.match(/Skipped: (\d+)/);
      
      if (resolvedMatch || skippedMatch) {
        results.poolAttribution = {
          processed: 500,
          resolved: resolvedMatch ? parseInt(resolvedMatch[1], 10) : 0,
          skipped: skippedMatch ? parseInt(skippedMatch[1], 10) : 0,
        };
      }
      console.log('[CRON] ✅ Pool attribution complete');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Pool attribution: ${msg}`);
      console.error('[CRON] ❌ Pool attribution failed:', msg);
    }

    // 2. Fees USD Calculation (5000 events/hour with batch processing)
    try {
      console.log('[CRON] Running fees USD calculation (5000 events)...');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout: feesOutput } = await execAsync(
        `npx tsx scripts/enrich-user-engagement-data.ts --skip-pool --limit=5000 --concurrency=12`,
        { timeout: 600000, maxBuffer: 10 * 1024 * 1024 } // 10 min timeout
      );
      
      // Parse output
      const calculatedMatch = feesOutput.match(/Calculated: (\d+)/);
      const failedMatch = feesOutput.match(/Failed: (\d+)/);
      
      if (calculatedMatch || failedMatch) {
        results.feesUsd = {
          calculated: calculatedMatch ? parseInt(calculatedMatch[1], 10) : 0,
          failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
        };
      }
      console.log('[CRON] ✅ Fees USD calculation complete');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Fees USD: ${msg}`);
      console.error('[CRON] ❌ Fees USD calculation failed:', msg);
    }

    // 3. Refresh Materialized Views (replaces range-status script)
    // Range status is now calculated via materialized view mv_position_range_status
    try {
      console.log('[CRON] Refreshing materialized views...');
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      try {
        const rangeStart = Date.now();
        await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_position_range_status"`;
        const rangeDuration = Date.now() - rangeStart;
        
        await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_pool_position_stats"`;
        await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_position_latest_event"`;
        
        results.rangeStatus = {
          processed: 0, // Views refresh all data
          calculated: 1,
          failed: 0,
          inRange: 0, // Stats available via view query
          outOfRange: 0,
        };
        console.log(`[CRON] ✅ Materialized views refreshed (${rangeDuration}ms)`);
      } finally {
        await prisma.$disconnect();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`View refresh: ${msg}`);
      console.error('[CRON] ❌ View refresh failed:', msg);
    }

    // 4. Position Snapshots (100 positions/hour)
    try {
      console.log('[CRON] Running position snapshots (100 positions)...');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout: snapshotOutput } = await execAsync(
        `npx tsx scripts/enrich-position-snapshots.ts --limit=100 --concurrency=10`,
        { timeout: 300000, maxBuffer: 10 * 1024 * 1024 } // 5 min timeout
      );
      
      // Parse output
      const createdMatch = snapshotOutput.match(/Created: (\d+)/);
      const failedMatch = snapshotOutput.match(/Failed: (\d+)/);
      const inRangeMatch = snapshotOutput.match(/IN_RANGE: (\d+)/);
      const outOfRangeMatch = snapshotOutput.match(/OUT_OF_RANGE: (\d+)/);
      const tvlMatch = snapshotOutput.match(/Total TVL: \$([\d.]+)/);
      
      if (createdMatch || failedMatch) {
        results.positionSnapshots = {
          processed: 100,
          created: createdMatch ? parseInt(createdMatch[1], 10) : 0,
          failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
          inRange: inRangeMatch ? parseInt(inRangeMatch[1], 10) : 0,
          outOfRange: outOfRangeMatch ? parseInt(outOfRangeMatch[1], 10) : 0,
          totalTvl: tvlMatch ? parseFloat(tvlMatch[1]) : 0,
        };
      }
      console.log('[CRON] ✅ Position snapshots complete');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Position snapshots: ${msg}`);
      console.error('[CRON] ❌ Position snapshots failed:', msg);
    }

    // 5. APR Calculation (100 pools/hour)
    try {
      console.log('[CRON] Running APR calculation (100 pools)...');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout: aprOutput } = await execAsync(
        `npx tsx scripts/enrich-apr-calculation.ts --limit=100`,
        { timeout: 120000, maxBuffer: 10 * 1024 * 1024 } // 2 min timeout
      );
      
      // Parse output
      const calculatedMatch = aprOutput.match(/Calculated: (\d+)/);
      const updatedMatch = aprOutput.match(/Updated: (\d+)/);
      const failedMatch = aprOutput.match(/Failed: (\d+)/);
      const avgFeesAprMatch = aprOutput.match(/Average Fees APR: ([\d.]+)%/);
      const avgTotalAprMatch = aprOutput.match(/Average Total APR: ([\d.]+)%/);
      
      if (calculatedMatch || updatedMatch) {
        results.aprCalculation = {
          calculated: calculatedMatch ? parseInt(calculatedMatch[1], 10) : 0,
          updated: updatedMatch ? parseInt(updatedMatch[1], 10) : 0,
          failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
          avgFeesApr: avgFeesAprMatch ? parseFloat(avgFeesAprMatch[1]) : 0,
          avgTotalApr: avgTotalAprMatch ? parseFloat(avgTotalAprMatch[1]) : 0,
        };
      }
      console.log('[CRON] ✅ APR calculation complete');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`APR calculation: ${msg}`);
      console.error('[CRON] ❌ APR calculation failed:', msg);
    }

    // 6. Impermanent Loss (200 positions/hour)
    try {
      console.log('[CRON] Running impermanent loss calculation (200 positions)...');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout: ilOutput } = await execAsync(
        `npx tsx scripts/enrich-impermanent-loss.ts --limit=200 --concurrency=10`,
        { timeout: 300000, maxBuffer: 10 * 1024 * 1024 } // 5 min timeout
      );
      
      // Parse output
      const calculatedMatch = ilOutput.match(/Calculated: (\d+)/);
      const failedMatch = ilOutput.match(/Failed: (\d+)/);
      const avgILMatch = ilOutput.match(/Average IL: ([\d.-]+)%/);
      
      if (calculatedMatch || failedMatch) {
        results.impermanentLoss = {
          processed: 200,
          calculated: calculatedMatch ? parseInt(calculatedMatch[1], 10) : 0,
          failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
          avgIL: avgILMatch ? parseFloat(avgILMatch[1]) : 0,
        };
      }
      console.log('[CRON] ✅ Impermanent loss calculation complete');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Impermanent loss: ${msg}`);
      console.error('[CRON] ❌ Impermanent loss calculation failed:', msg);
    }

    // 7. rFLR Vesting (200 positions/hour)
    try {
      console.log('[CRON] Running rFLR vesting calculation (200 positions)...');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout: rflrOutput } = await execAsync(
        `npx tsx scripts/enrich-rflr-vesting.ts --limit=200 --concurrency=10`,
        { timeout: 300000, maxBuffer: 10 * 1024 * 1024 } // 5 min timeout
      );
      
      // Parse output
      const updatedMatch = rflrOutput.match(/Updated: (\d+)/);
      const failedMatch = rflrOutput.match(/Failed: (\d+)/);
      const totalRflrMatch = rflrOutput.match(/Total rFLR: ([\d.]+)/);
      const totalVestedMatch = rflrOutput.match(/Vested rFLR: ([\d.]+)/);
      
      if (updatedMatch || failedMatch) {
        results.rflrVesting = {
          processed: 200,
          updated: updatedMatch ? parseInt(updatedMatch[1], 10) : 0,
          failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
          totalRflr: totalRflrMatch ? parseFloat(totalRflrMatch[1]) : 0,
          totalVestedRflr: totalVestedMatch ? parseFloat(totalVestedMatch[1]) : 0,
        };
      }
      console.log('[CRON] ✅ rFLR vesting calculation complete');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`rFLR vesting: ${msg}`);
      console.error('[CRON] ❌ rFLR vesting calculation failed:', msg);
    }

    // 8. Unclaimed Fees Tracking (100 positions/hour)
    try {
      console.log('[CRON] Running unclaimed fees tracking (100 positions)...');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout: unclaimedOutput } = await execAsync(
        `npx tsx scripts/enrich-unclaimed-fees.ts --limit=100 --concurrency=10`,
        { timeout: 300000, maxBuffer: 10 * 1024 * 1024 } // 5 min timeout
      );
      
      // Parse output
      const updatedMatch = unclaimedOutput.match(/Updated: (\d+)/);
      const failedMatch = unclaimedOutput.match(/Failed: (\d+)/);
      const totalUnclaimedMatch = unclaimedOutput.match(/Total Unclaimed: \$([\d.]+)/);
      
      if (updatedMatch || failedMatch) {
        results.unclaimedFees = {
          processed: 100,
          updated: updatedMatch ? parseInt(updatedMatch[1], 10) : 0,
          failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
          totalUnclaimedUsd: totalUnclaimedMatch ? parseFloat(totalUnclaimedMatch[1]) : 0,
        };
      }
      console.log('[CRON] ✅ Unclaimed fees tracking complete');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Unclaimed fees: ${msg}`);
      console.error('[CRON] ❌ Unclaimed fees tracking failed:', msg);
    }

    // 9. Position Health Metrics (200 positions/hour)
    try {
      console.log('[CRON] Running position health metrics (200 positions)...');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout: healthOutput } = await execAsync(
        `npx tsx scripts/enrich-position-health.ts --limit=200`,
        { timeout: 180000, maxBuffer: 10 * 1024 * 1024 } // 3 min timeout
      );
      
      // Parse output
      const updatedMatch = healthOutput.match(/Updated: (\d+)/);
      const failedMatch = healthOutput.match(/Failed: (\d+)/);
      const avgPctMatch = healthOutput.match(/Average % In-Range: ([\d.]+)%/);
      
      if (updatedMatch || failedMatch) {
        results.positionHealth = {
          processed: 200,
          updated: updatedMatch ? parseInt(updatedMatch[1], 10) : 0,
          failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
          avgPctInRange: avgPctMatch ? parseFloat(avgPctMatch[1]) : 0,
        };
      }
      console.log('[CRON] ✅ Position health metrics complete');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Position health: ${msg}`);
      console.error('[CRON] ❌ Position health metrics failed:', msg);
    }

    // 10. Pool Volume Metrics (50 pools/hour)
    try {
      console.log('[CRON] Running pool volume metrics (50 pools)...');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout: volumeOutput } = await execAsync(
        `npx tsx scripts/enrich-pool-volume.ts --limit=50`,
        { timeout: 120000, maxBuffer: 10 * 1024 * 1024 } // 2 min timeout
      );
      
      // Parse output
      const updatedMatch = volumeOutput.match(/Updated: (\d+)/);
      const failedMatch = volumeOutput.match(/Failed: (\d+)/);
      const totalSwapsMatch = volumeOutput.match(/Total Swaps \(24h\): (\d+)/);
      
      if (updatedMatch || failedMatch) {
        results.poolVolume = {
          processed: 50,
          updated: updatedMatch ? parseInt(updatedMatch[1], 10) : 0,
          failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
          totalSwaps: totalSwapsMatch ? parseInt(totalSwapsMatch[1], 10) : 0,
        };
      }
      console.log('[CRON] ✅ Pool volume metrics complete');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Pool volume: ${msg}`);
      console.error('[CRON] ❌ Pool volume metrics failed:', msg);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[CRON] ✅ Hourly enrichment complete in ${elapsed}s`);

    return res.status(200).json({
      success: errors.length === 0,
      timestamp: new Date().toISOString(),
      results,
      elapsed: `${elapsed}s`,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error) {
    console.error('[CRON] ❌ Fatal error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


