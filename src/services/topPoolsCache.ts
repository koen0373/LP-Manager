/**
 * Top Pools Cache Service
 * Reads and manages cached top pools data
 */

import fs from 'fs/promises';
import path from 'path';
import type { PoolSnapshot } from './topPoolsScanner';

const CACHE_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'top-pools-cache.json');

export type TopPoolsCache = {
  version: string;
  generatedAt: string;
  expiresAt: string;
  scannedPositions: {
    enosys: number;
    sparkdex: number;
    blazeswap: number;
  };
  providers: {
    enosys: PoolSnapshot[];
    sparkdex: PoolSnapshot[];
    blazeswap: PoolSnapshot[];
  };
  meta: {
    totalScanned: number;
    totalFiltered: number;
    scanDuration: string;
    cacheSize?: string;
  };
};

/**
 * Read top pools from cache file
 * Returns null if cache doesn't exist or is expired
 */
export async function readTopPoolsCache(): Promise<TopPoolsCache | null> {
  try {
    const json = await fs.readFile(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(json) as TopPoolsCache;

    // Check if expired
    const expiresAt = new Date(cache.expiresAt).getTime();
    if (Date.now() > expiresAt) {
      console.warn('[TopPoolsCache] Cache expired at', cache.expiresAt);
      return null;
    }

    console.log('[TopPoolsCache] Cache hit, generated at', cache.generatedAt);
    return cache;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn('[TopPoolsCache] Cache file not found');
      return null;
    }
    console.error('[TopPoolsCache] Failed to read cache:', error);
    return null;
  }
}

/**
 * Write top pools cache to file
 */
export async function writeTopPoolsCache(cache: TopPoolsCache): Promise<void> {
  try {
    // Ensure directory exists
    await fs.mkdir(CACHE_DIR, { recursive: true });

    // Write to file
    const json = JSON.stringify(cache, null, 2);
    await fs.writeFile(CACHE_FILE, json, 'utf-8');

    const sizeKB = Math.round(Buffer.byteLength(json, 'utf-8') / 1024);
    console.log(`[TopPoolsCache] Cache written successfully (${sizeKB}KB)`);
  } catch (error) {
    console.error('[TopPoolsCache] Failed to write cache:', error);
    throw error;
  }
}

/**
 * Select pools from cache
 * Cache already contains top 3 per provider (9 total)
 * Just return them all, maintaining provider diversity
 */
export function selectDiversePools(
  cache: TopPoolsCache,
  limit: number
): PoolSnapshot[] {
  // Cache already contains top 3 per provider (9 total)
  // Just return them all, sorted by TVL
  const allPools = [
    ...cache.providers.enosys,
    ...cache.providers.sparkdex,
    ...cache.providers.blazeswap,
  ];

  console.log('[TopPoolsCache] Selected pools by provider:', {
    enosys: cache.providers.enosys.length,
    sparkdex: cache.providers.sparkdex.length,
    blazeswap: cache.providers.blazeswap.length,
  });

  // Sort by TVL descending and return up to limit
  return allPools.sort((a, b) => b.tvlUsd - a.tvlUsd).slice(0, limit);
}

/**
 * Get cache age in minutes
 */
export function getCacheAge(cache: TopPoolsCache): number {
  const generatedAt = new Date(cache.generatedAt).getTime();
  const now = Date.now();
  return Math.round((now - generatedAt) / 1000 / 60);
}

/**
 * Check if cache needs refresh (within 1 hour of expiry)
 */
export function needsRefresh(cache: TopPoolsCache): boolean {
  const expiresAt = new Date(cache.expiresAt).getTime();
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  return now > expiresAt - oneHour;
}

