import type { NextApiRequest, NextApiResponse } from 'next';
import { isAddress } from 'viem';
import { getLpPositionsOnChain } from '../../src/services/pmFallback';
import { getWalletPositionsViaFlareScan } from '../../src/services/flarescanService';
import { clearCaches } from '../../src/utils/poolHelpers';
import { clearRflrRewardCache } from '../../src/services/rflrRewards';
import type { PositionRow } from '../../src/types/positions';

function sanitizeBigInts(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeBigInts(entry));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = sanitizeBigInts(val);
    }
    return result;
  }

  return value;
}

// Helper to serialize PositionRow for JSON response
function serializePositionRow(position: PositionRow): PositionRow {
  const sanitized = sanitizeBigInts(position) as Record<string, unknown>;

  return {
    ...(sanitized as unknown as PositionRow),
    // Ensure all numeric fields are properly serialized
    amount0: Number(sanitized.amount0 ?? 0),
    amount1: Number(sanitized.amount1 ?? 0),
    tvlUsd: Number(sanitized.tvlUsd ?? 0),
    rewardsUsd: Number(sanitized.rewardsUsd ?? 0),
    lowerPrice: Number(sanitized.lowerPrice ?? 0),
    upperPrice: Number(sanitized.upperPrice ?? 0),
    rflrAmount: Number(sanitized.rflrAmount ?? 0),
    rflrUsd: Number(sanitized.rflrUsd ?? 0),
    rflrPriceUsd: Number(sanitized.rflrPriceUsd ?? 0),
    feeTierBps: Number(sanitized.feeTierBps ?? 0),
    // Ensure boolean fields are properly serialized
    inRange: Boolean(sanitized.inRange ?? false),
    isInRange: Boolean(sanitized.isInRange ?? false),
  };
}

const CACHE_TTL_MS = 0; // No cache for testing
const cache = new Map<string, { expires: number; data: PositionRow[] }>();

// Clear cache to force fresh data
console.log(`[DEBUG] [API] Clearing all caches for fresh data`);
cache.clear();
clearCaches();
clearRflrRewardCache();

function getCached(address: string): PositionRow[] | null {
  const entry = cache.get(address);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expires) {
    cache.delete(address);
    return null;
  }

  return entry.data;
}

function setCached(address: string, data: PositionRow[]): void {
  cache.set(address, { data, expires: Date.now() + CACHE_TTL_MS });

  if (cache.size > 100) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const addressParam = typeof req.query.address === 'string' ? req.query.address : '';
  if (!addressParam || !isAddress(addressParam)) {
    res.status(400).json({ error: 'Invalid or missing wallet address' });
    return;
  }

  const normalizedAddress = addressParam.toLowerCase();

  const cached = getCached(normalizedAddress);
  if (cached) {
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
    res.status(200).json(cached);
    return;
  }

  try {
    console.log(`[API] Fetching positions for address: ${normalizedAddress}`);
    const viemPositions = await getLpPositionsOnChain(normalizedAddress as `0x${string}`);
    console.log(`[API] Received ${viemPositions.length} positions from Viem`);
    console.log(`[API] First position sample:`, {
      id: viemPositions[0]?.id,
      tvlUsd: viemPositions[0]?.tvlUsd,
      rewardsUsd: viemPositions[0]?.rewardsUsd,
      amount0: viemPositions[0]?.amount0,
      amount1: viemPositions[0]?.amount1
    });
    const serializedPositions = viemPositions.map(serializePositionRow);
    setCached(normalizedAddress, serializedPositions);
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
    res.status(200).json(serializedPositions);
    return;
  } catch (viemError) {
    console.error('Viem position fetch failed in /api/positions:', viemError);
  }

  try {
    const fallbackPositions = await getWalletPositionsViaFlareScan(normalizedAddress);
    const serializedFallback = fallbackPositions.map(serializePositionRow);
    setCached(normalizedAddress, serializedFallback);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(serializedFallback);
  } catch (fallbackError) {
    console.error('Fallback FlareScan fetch failed in /api/positions:', fallbackError);
    res.status(502).json({
      error: 'Unable to fetch positions',
      details: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
    });
  }
}
