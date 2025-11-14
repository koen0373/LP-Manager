import type { NextApiRequest, NextApiResponse } from 'next';
import { getNetworkSummary, disconnect } from '@/lib/analytics/db';

// Simple in-memory TTL cache (per-process)
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 30000; // 30 seconds

function getCacheKey(): string {
  return 'analytics:summary';
}

function getCached(): any | null {
  const key = getCacheKey();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  if (cached) {
    cache.delete(key);
  }
  return null;
}

function setCache(data: any): void {
  const key = getCacheKey();
  cache.set(key, {
    data,
    expires: Date.now() + CACHE_TTL,
  });
}

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  if (_req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cached = getCached();
  if (cached) {
    return res.status(200).json(cached);
  }

  const result = await getNetworkSummary();
  setCache(result);

  await disconnect();

  return res.status(200).json(result);
}
