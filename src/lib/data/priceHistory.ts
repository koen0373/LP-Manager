// Build price history from position events and pool events
import { db } from '@/store/prisma';
import { tickToPrice } from '@/utils/poolHelpers';

export interface PriceHistoryPoint {
  t: string; // Unix timestamp as string
  p: number; // Price (token1 per token0)
}

/**
 * Build price history for a pool from stored events
 * Uses PositionEvent records which have tick/price data
 */
export async function buildPriceHistory(
  poolAddress: string,
  decimals0: number,
  decimals1: number,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
    maxPoints?: number;
  } = {}
): Promise<PriceHistoryPoint[]> {
  const {
    fromTimestamp = 0,
    toTimestamp = Math.floor(Date.now() / 1000),
    maxPoints = 500,
  } = options;

  try {
    // Fetch position events with tick data (Swap events are most relevant for price)
    // But also include Mint/Burn/Collect as they have price info
    const events = await db.positionEvent.findMany({
      where: {
        pool: poolAddress.toLowerCase(),
        timestamp: {
          gte: fromTimestamp,
          lte: toTimestamp,
        },
        OR: [
          { tick: { not: null } },
          { price1Per0: { not: null } },
        ],
      },
      orderBy: {
        timestamp: 'asc',
      },
      select: {
        timestamp: true,
        tick: true,
        price1Per0: true,
      },
    });

    if (events.length === 0) {
      // No events found, return empty array
      return [];
    }

    // Convert to price points
    const pricePoints: PriceHistoryPoint[] = [];
    
    for (const event of events) {
      let price = 0;

      // Prefer stored price1Per0
      if (event.price1Per0 !== null && event.price1Per0 > 0) {
        price = event.price1Per0;
      } 
      // Fallback to calculating from tick
      else if (event.tick !== null) {
        try {
          price = tickToPrice(event.tick, decimals0, decimals1);
        } catch (error) {
          console.warn(`[PRICE_HISTORY] Failed to calculate price from tick ${event.tick}:`, error);
          continue;
        }
      } else {
        // No price data available
        continue;
      }

      pricePoints.push({
        t: event.timestamp.toString(),
        p: price,
      });
    }

    // Downsample if we have too many points
    if (pricePoints.length > maxPoints) {
      return downsamplePricePoints(pricePoints, maxPoints);
    }

    return pricePoints;
  } catch (error) {
    console.error('[PRICE_HISTORY] Error building price history:', error);
    return [];
  }
}

/**
 * Downsample price points using largest-triangle-three-buckets algorithm (simplified)
 * This preserves visual shape while reducing point count
 */
function downsamplePricePoints(
  points: PriceHistoryPoint[],
  targetCount: number
): PriceHistoryPoint[] {
  if (points.length <= targetCount) {
    return points;
  }

  const bucketSize = Math.floor(points.length / targetCount);
  const downsampled: PriceHistoryPoint[] = [];

  // Always keep first point
  downsampled.push(points[0]);

  // Sample from buckets
  for (let i = 1; i < targetCount - 1; i++) {
    const bucketStart = i * bucketSize;
    const bucketEnd = Math.min(bucketStart + bucketSize, points.length);
    
    // Take the point with median price in this bucket (simple but effective)
    const bucket = points.slice(bucketStart, bucketEnd);
    const sortedByPrice = [...bucket].sort((a, b) => a.p - b.p);
    const medianPoint = sortedByPrice[Math.floor(sortedByPrice.length / 2)];
    
    downsampled.push(medianPoint);
  }

  // Always keep last point
  downsampled.push(points[points.length - 1]);

  return downsampled;
}

/**
 * Build price history from pool-level Swap events (alternative approach)
 * This fetches from PoolEvent table which might have more granular swap data
 */
export async function buildPriceHistoryFromSwaps(
  poolAddress: string,
  decimals0: number,
  decimals1: number,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
    maxPoints?: number;
  } = {}
): Promise<PriceHistoryPoint[]> {
  const {
    fromTimestamp = 0,
    toTimestamp = Math.floor(Date.now() / 1000),
    maxPoints = 500,
  } = options;

  try {
    // Fetch Swap events from PoolEvent table
    const swaps = await db.poolEvent.findMany({
      where: {
        pool: poolAddress.toLowerCase(),
        eventName: 'Swap',
        timestamp: {
          gte: fromTimestamp,
          lte: toTimestamp,
        },
        tick: { not: null },
      },
      orderBy: {
        timestamp: 'asc',
      },
      select: {
        timestamp: true,
        tick: true,
        sqrtPriceX96: true,
      },
    });

    if (swaps.length === 0) {
      return [];
    }

    // Convert to price points
    const pricePoints: PriceHistoryPoint[] = [];
    
    for (const swap of swaps) {
      if (swap.tick === null) continue;

      try {
        const price = tickToPrice(swap.tick, decimals0, decimals1);
        pricePoints.push({
          t: swap.timestamp.toString(),
          p: price,
        });
      } catch (error) {
        console.warn(`[PRICE_HISTORY] Failed to calculate price from tick ${swap.tick}:`, error);
        continue;
      }
    }

    // Downsample if needed
    if (pricePoints.length > maxPoints) {
      return downsamplePricePoints(pricePoints, maxPoints);
    }

    return pricePoints;
  } catch (error) {
    console.error('[PRICE_HISTORY] Error building price history from swaps:', error);
    return [];
  }
}

/**
 * Get current price from most recent event
 */
export async function getCurrentPriceFromEvents(
  poolAddress: string,
  decimals0: number,
  decimals1: number
): Promise<number | null> {
  try {
    // Try PositionEvent first
    const recentEvent = await db.positionEvent.findFirst({
      where: {
        pool: poolAddress.toLowerCase(),
        OR: [
          { tick: { not: null } },
          { price1Per0: { not: null } },
        ],
      },
      orderBy: {
        timestamp: 'desc',
      },
      select: {
        tick: true,
        price1Per0: true,
      },
    });

    if (recentEvent) {
      if (recentEvent.price1Per0 !== null && recentEvent.price1Per0 > 0) {
        return recentEvent.price1Per0;
      }
      if (recentEvent.tick !== null) {
        try {
          return tickToPrice(recentEvent.tick, decimals0, decimals1);
        } catch {
          // Fall through
        }
      }
    }

    // Fallback to PoolEvent Swap
    const recentSwap = await db.poolEvent.findFirst({
      where: {
        pool: poolAddress.toLowerCase(),
        eventName: 'Swap',
        tick: { not: null },
      },
      orderBy: {
        timestamp: 'desc',
      },
      select: {
        tick: true,
      },
    });

    if (recentSwap && recentSwap.tick !== null) {
      try {
        return tickToPrice(recentSwap.tick, decimals0, decimals1);
      } catch {
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error('[PRICE_HISTORY] Error getting current price:', error);
    return null;
  }
}

