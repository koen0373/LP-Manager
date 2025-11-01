import type { NextApiRequest, NextApiResponse } from 'next';

import {
  ensureRpcConfigured,
  getProvider,
  isBlazeSwapEnabled,
  paginatePairs,
} from '@/lib/blazeswap/read';

type PairListResponse = {
  ok: true;
  factory: string;
  pairs: string[];
  nextStart: number | null;
  totalPairs: number;
};

type ErrorResponse = {
  ok: false;
  error: string;
};

type CacheEntry<T> = {
  expires: number;
  value: T;
};

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry<PairListResponse>>();

function getCache(key: string): PairListResponse | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key: string, value: PairListResponse): void {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

function parseNumberParam(value: string | string[] | undefined, fallback: number) {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PairListResponse | ErrorResponse>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!isBlazeSwapEnabled()) {
    return res.status(404).json({ ok: false, error: 'BlazeSwap integration disabled' });
  }

  try {
    ensureRpcConfigured();
  } catch {
    return res
      .status(503)
      .json({ ok: false, error: 'FLARE_RPC_URL not configured' });
  }

  const start = parseNumberParam(req.query.start, 0);
  const limit = parseNumberParam(req.query.limit, 50);
  const cacheKey = `${start}:${limit}`;

  const cached = getCache(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  try {
    const provider = getProvider();
    const { factory, pairs, totalPairs, nextStart } = await paginatePairs(provider, {
      start,
      limit,
    });

    const payload: PairListResponse = {
      ok: true,
      factory,
      pairs,
      totalPairs,
      nextStart,
    };

    setCache(cacheKey, payload);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('[api/blazeswap/pairs] failed', error);
    return res.status(502).json({
      ok: false,
      error: 'Could not fetch BlazeSwap pairs right now.',
    });
  }
}
