/**
 * Pool Count History Service
 * 
 * Tracks pool count growth over time for Enosys and SparkDEX
 * Stores snapshots in a simple JSON file
 */

import { promises as fs } from 'fs';
import path from 'path';

interface PoolSnapshot {
  timestamp: string;
  enosys: number;
  sparkdex: number;
}

interface GrowthResult {
  enosys: {
    change24h: number | null;
    change7d: number | null;
    change30d: number | null;
  };
  sparkdex: {
    change24h: number | null;
    change7d: number | null;
    change30d: number | null;
  };
}

const HISTORY_FILE = path.join(process.cwd(), 'data/pool-count-history.json');

/**
 * Load pool count history from file
 */
async function loadHistory(): Promise<PoolSnapshot[]> {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Ensure it's an array
    if (!Array.isArray(parsed)) {
      console.warn('[PoolCountHistory] History file is not an array, returning empty array');
      return [];
    }
    
    return parsed;
  } catch (error) {
    // File doesn't exist or is corrupted, return empty array
    return [];
  }
}

/**
 * Save pool count history to file
 */
async function saveHistory(history: PoolSnapshot[]): Promise<void> {
  // Ensure data directory exists
  await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
  
  // Keep only last 90 days of data
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const filtered = history.filter(
    (snapshot) => new Date(snapshot.timestamp).getTime() > ninetyDaysAgo
  );
  
  await fs.writeFile(HISTORY_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
}

/**
 * Add a new snapshot
 */
export async function addSnapshot(enosys: number, sparkdex: number): Promise<void> {
  const history = await loadHistory();
  
  // Check if we already have a snapshot from the last hour
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentSnapshot = history.find(
    (snapshot) => new Date(snapshot.timestamp).getTime() > oneHourAgo
  );
  
  // Don't add duplicate snapshots within an hour
  if (recentSnapshot) {
    return;
  }
  
  history.push({
    timestamp: new Date().toISOString(),
    enosys,
    sparkdex,
  });
  
  await saveHistory(history);
}

/**
 * Calculate pool count growth rates
 */
export async function calculatePoolGrowth(
  currentEnosys: number,
  currentSparkdex: number
): Promise<GrowthResult> {
  const history = await loadHistory();
  
  const result: GrowthResult = {
    enosys: { change24h: null, change7d: null, change30d: null },
    sparkdex: { change24h: null, change7d: null, change30d: null },
  };
  
  if (history.length === 0) {
    return result;
  }
  
  const now = Date.now();
  const day24Ago = now - 24 * 60 * 60 * 1000;
  const days7Ago = now - 7 * 24 * 60 * 60 * 1000;
  const days30Ago = now - 30 * 24 * 60 * 60 * 1000;
  
  // Find closest snapshots to each time period
  const snapshot24h = findClosestSnapshot(history, day24Ago);
  const snapshot7d = findClosestSnapshot(history, days7Ago);
  const snapshot30d = findClosestSnapshot(history, days30Ago);
  
  // Calculate changes
  if (snapshot24h) {
    result.enosys.change24h = currentEnosys - snapshot24h.enosys;
    result.sparkdex.change24h = currentSparkdex - snapshot24h.sparkdex;
  }
  
  if (snapshot7d) {
    result.enosys.change7d = currentEnosys - snapshot7d.enosys;
    result.sparkdex.change7d = currentSparkdex - snapshot7d.sparkdex;
  }
  
  if (snapshot30d) {
    result.enosys.change30d = currentEnosys - snapshot30d.enosys;
    result.sparkdex.change30d = currentSparkdex - snapshot30d.sparkdex;
  }
  
  return result;
}

/**
 * Find the closest snapshot to a given timestamp
 */
function findClosestSnapshot(
  history: PoolSnapshot[],
  targetTimestamp: number
): PoolSnapshot | null {
  if (history.length === 0) return null;
  
  let closest: PoolSnapshot | null = null;
  let minDiff = Infinity;
  
  for (const snapshot of history) {
    const snapshotTime = new Date(snapshot.timestamp).getTime();
    const diff = Math.abs(snapshotTime - targetTimestamp);
    
    if (diff < minDiff) {
      minDiff = diff;
      closest = snapshot;
    }
  }
  
  // Only return if snapshot is within 3 hours of target
  if (minDiff < 3 * 60 * 60 * 1000) {
    return closest;
  }
  
  return null;
}

