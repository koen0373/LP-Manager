import type { NextApiRequest, NextApiResponse } from 'next';
import { readTopPoolsCache, selectDiversePools, getCacheAge } from '@/services/topPoolsCache';

type ApiResponse = {
  ok: boolean;
  mode: 'top';
  generatedAt: string;
  expiresAt: string;
  items: unknown[];
  meta: {
    cacheAge: string;
    nextRefresh: string;
    scannedPositions: number;
  };
} | {
  ok: false;
  error: string;
  placeholder?: boolean;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed',
    });
  }

  const limit = Number(req.query.limit) || 9;

  try {
    // Read from cache
    const cache = await readTopPoolsCache();

    if (!cache) {
      console.warn('[api/pools/top] Cache not available');
      return res.status(503).json({
        ok: false,
        error: 'Top pools cache not available. Please try again later.',
        placeholder: true,
      });
    }

    // Select diverse pools
    const pools = selectDiversePools(cache, limit);

    const cacheAge = getCacheAge(cache);

    // Set cache headers (cache for 1 hour on client)
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=7200'
    );

    return res.status(200).json({
      ok: true,
      mode: 'top',
      generatedAt: cache.generatedAt,
      expiresAt: cache.expiresAt,
      items: pools,
      meta: {
        cacheAge: `${cacheAge}min`,
        nextRefresh: cache.expiresAt,
        scannedPositions:
          cache.meta.totalScanned,
      },
    });
  } catch (error) {
    console.error('[api/pools/top] Error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
}

