#!/usr/bin/env tsx
/**
 * Cache Top Pools Script
 * Background job to scan and cache top pools
 * Run daily via cron: 0 3 * * * (3 AM UTC)
 */

import { getTopPoolsByTVL } from '../src/services/topPoolsScanner';
import { writeTopPoolsCache, type TopPoolsCache } from '../src/services/topPoolsCache';

async function cacheTopPools() {
  console.log('========================================');
  console.log('[CacheTopPools] Starting daily scan...');
  console.log('[CacheTopPools] Time:', new Date().toISOString());
  console.log('========================================');

  const startTime = Date.now();

  try {
    // Scan top pools (faster with smaller sample)
    const result = await getTopPoolsByTVL({
      limit: 60, // Get top 60 total (will keep top 20 per provider)
      minTvl: 500, // Minimum $500 TVL
      providers: ['enosys', 'sparkdex'], // V3 providers only for now
      sampleSize: 50, // Sample 50 recent positions per provider (faster!)
    });

    const duration = Math.round((Date.now() - startTime) / 1000);

    // Select top 20 per provider
    const topPerProvider = {
      enosys: result.byProvider.enosys.slice(0, 20),
      sparkdex: result.byProvider.sparkdex.slice(0, 20),
      blazeswap: result.byProvider.blazeswap.slice(0, 20),
    };

    // Build cache object
    const cache: TopPoolsCache = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      scannedPositions: result.meta.scannedPositions,
      providers: topPerProvider,
      meta: {
        totalScanned: result.meta.totalScanned,
        totalFiltered: result.meta.totalFiltered,
        scanDuration: `${duration}s`,
      },
    };

    // Write to file
    await writeTopPoolsCache(cache);

    // Summary
    const totalPools = Object.values(topPerProvider).reduce(
      (sum, pools) => sum + pools.length,
      0
    );

    console.log('========================================');
    console.log('[CacheTopPools] ✅ Cache updated successfully');
    console.log('[CacheTopPools]    Duration:', duration, 'seconds');
    console.log('[CacheTopPools]    Total pools:', totalPools);
    console.log('[CacheTopPools]    By provider:', {
      enosys: topPerProvider.enosys.length,
      sparkdex: topPerProvider.sparkdex.length,
      blazeswap: topPerProvider.blazeswap.length,
    });
    console.log('[CacheTopPools]    Expires at:', cache.expiresAt);
    console.log('========================================');

    process.exit(0);
  } catch (error) {
    console.error('========================================');
    console.error('[CacheTopPools] ❌ Failed to cache top pools');
    console.error('[CacheTopPools] Error:', error);
    console.error('========================================');
    process.exit(1);
  }
}

// Run
cacheTopPools();

