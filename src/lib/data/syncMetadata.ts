/**
 * Sync Metadata Tracking
 * Tracks when positions were last synced to determine cache freshness
 */

import { db } from '@/store/prisma';

/**
 * Get the last sync time for a position
 * Returns null if never synced
 */
export async function getLastSyncTime(tokenId: string): Promise<Date | null> {
  try {
    // Check if we have any events for this position
    const latestEvent = await db.positionEvent.findFirst({
      where: { tokenId },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });

    return latestEvent ? new Date(latestEvent.timestamp * 1000) : null;
  } catch (error) {
    console.warn('[SYNC_META] Failed to get last sync time:', error);
    return null;
  }
}

/**
 * Update the sync timestamp for a position
 * This is implicit - the latest event's createdAt serves as sync time
 */
export async function updateSyncTime(tokenId: string): Promise<void> {
  // No-op: createdAt is automatically set by Prisma on insert
  // We rely on the latest event's createdAt as the sync timestamp
  console.log(`[SYNC_META] Position ${tokenId} synced at ${new Date().toISOString()}`);
}

/**
 * Check if a position's cache is stale (>5 minutes old)
 */
export async function isCacheStale(tokenId: string, maxAgeMs: number = 5 * 60 * 1000): Promise<boolean> {
  const lastSync = await getLastSyncTime(tokenId);
  
  if (!lastSync) {
    return true; // Never synced = stale
  }
  
  const age = Date.now() - lastSync.getTime();
  return age > maxAgeMs;
}

/**
 * Check if a position has any cached data
 */
export async function hasCachedData(tokenId: string): Promise<boolean> {
  try {
    const [eventCount, transferCount] = await Promise.all([
      db.positionEvent.count({ where: { tokenId } }),
      db.positionTransfer.count({ where: { tokenId } }),
    ]);
    
    return eventCount > 0 || transferCount > 0;
  } catch (error) {
    console.warn('[SYNC_META] Failed to check cached data:', error);
    return false;
  }
}

