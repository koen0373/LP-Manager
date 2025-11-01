import type { NextApiRequest, NextApiResponse } from 'next';
import { isAddress } from 'ethers/lib/utils';

import {
  ensureRpcConfigured,
  fetchTokenMeta,
  getProvider,
  isBlazeSwapEnabled,
  readPairSnapshot,
  readUserLpPosition,
} from '@/lib/blazeswap/read';

type SuccessResponse = {
  ok: true;
  snapshot: Awaited<ReturnType<typeof readPairSnapshot>>;
  tokens: {
    token0: Awaited<ReturnType<typeof fetchTokenMeta>>;
    token1: Awaited<ReturnType<typeof fetchTokenMeta>>;
  };
  position?: Awaited<ReturnType<typeof readUserLpPosition>>;
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
const cache = new Map<string, CacheEntry<SuccessResponse>>();

function getCache(key: string): SuccessResponse | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key: string, value: SuccessResponse): void {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!isBlazeSwapEnabled()) {
    return res.status(404).json({ ok: false, error: 'BlazeSwap integration disabled' });
  }

  const { address } = req.query;
  if (typeof address !== 'string' || !isAddress(address)) {
    return res.status(400).json({ ok: false, error: 'Invalid pair address' });
  }

  try {
    ensureRpcConfigured();
  } catch {
    return res
      .status(503)
      .json({ ok: false, error: 'FLARE_RPC_URL not configured' });
  }

  const userAddress =
    typeof req.query.user === 'string' && isAddress(req.query.user)
      ? req.query.user
      : null;

  const cacheKey = userAddress ? `${address}:${userAddress}` : address;
  const cached = getCache(cacheKey);
  if (cached && !userAddress) {
    return res.status(200).json(cached);
  }

  try {
    const provider = getProvider();
    const snapshot = await readPairSnapshot(provider, address);
    const [token0Meta, token1Meta] = await Promise.all([
      fetchTokenMeta(provider, snapshot.token0),
      fetchTokenMeta(provider, snapshot.token1),
    ]);

    const payload: SuccessResponse = {
      ok: true,
      snapshot,
      tokens: {
        token0: token0Meta,
        token1: token1Meta,
      },
    };

    if (userAddress) {
      const position = await readUserLpPosition(provider, userAddress, address);
      payload.position = position;
    } else {
      setCache(cacheKey, payload);
    }

    return res.status(200).json(payload);
  } catch (error) {
    console.error('[api/blazeswap/pair] failed', error);
    return res.status(502).json({
      ok: false,
      error: 'Could not load BlazeSwap pair details.',
    });
  }
}
