import type { NextApiRequest, NextApiResponse } from 'next';
import { isAddress } from 'viem';
import { getLpPositionsOnChain } from '../../src/services/pmFallback';
import { getWalletPositionsViaFlareScan } from '../../src/services/flarescanService';
import type { PositionRow } from '../../src/types/positions';

// Helper to serialize PositionRow for JSON response
function serializePositionRow(position: any): PositionRow {
  return {
    ...position,
    // Convert any remaining BigInt values to strings
    amount0: position.amount0?.toString() || '0',
    amount1: position.amount1?.toString() || '0',
    // Ensure all numeric fields are properly serialized
    tvlUsd: Number(position.tvlUsd) || 0,
    rewardsUsd: Number(position.rewardsUsd) || 0,
    lowerPrice: Number(position.lowerPrice) || 0,
    upperPrice: Number(position.upperPrice) || 0,
  };
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { expires: number; data: PositionRow[] }>();

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
    const viemPositions = await getLpPositionsOnChain(normalizedAddress as `0x${string}`);
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
    setCached(normalizedAddress, fallbackPositions);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(fallbackPositions);
  } catch (fallbackError) {
    console.error('Fallback FlareScan fetch failed in /api/positions:', fallbackError);
    res.status(502).json({
      error: 'Unable to fetch positions',
      details: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
    });
  }
}
