import type { NextApiRequest, NextApiResponse } from 'next';
import { getPoolAnalytics, disconnect } from '@/lib/analytics/db';

// Simple in-memory TTL cache (per-process)
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 30000; // 30 seconds

function getCacheKey(poolId: string): string {
  return `analytics:pool:${poolId}`;
}

function getCached(poolId: string): any | null {
  const key = getCacheKey(poolId);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  if (cached) {
    cache.delete(key);
  }
  return null;
}

function setCache(poolId: string, data: any): void {
  const key = getCacheKey(poolId);
  cache.set(key, {
    data,
    expires: Date.now() + CACHE_TTL,
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Pool ID required' });
  }

  const cached = getCached(id);
  if (cached) {
    return res.status(200).json(cached);
  }

  const result = await getPoolAnalytics(id);
  setCache(id, result);

  await disconnect();

  return res.status(200).json(result);
}


