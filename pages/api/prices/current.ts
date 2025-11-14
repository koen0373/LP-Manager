import type { NextApiRequest, NextApiResponse } from 'next';
import { getTokenPricesBatch, canonicalSymbol } from '@/lib/prices/tokenPriceService';

type PriceEntry = {
  symbol: string;
  priceUsd: number;
  source: 'coingecko';
};

type SuccessResponse = {
  ok: true;
  ts: string;
  prices: PriceEntry[];
  warnings?: string[];
};

type ErrorResponse = {
  ok: false;
  error: string;
};

const CACHE_TTL_SECONDS = 60;
const MAX_SYMBOLS = 50;

let cache: { data: SuccessResponse; expires: number } | null = null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const symbolsParam = req.query.symbols as string | undefined;
    if (!symbolsParam) {
      return res.status(400).json({ ok: false, error: 'Missing required query parameter: symbols' });
    }

    const inputSymbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
    const symbols = inputSymbols.map(canonicalSymbol);
    
    if (symbols.length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid symbols provided' });
    }

    if (symbols.length > MAX_SYMBOLS) {
      return res.status(400).json({ 
        ok: false, 
        error: `Too many symbols (max ${MAX_SYMBOLS})` 
      });
    }

    // Check cache (simple single-slot cache for common multi-symbol queries)
    const now = Date.now();
    const cacheKey = [...symbols].sort().join(',');
    
    if (cache && cache.expires > now) {
      const cachedSymbols = cache.data.prices.map(p => p.symbol).sort().join(',');
      if (cachedSymbols === cacheKey) {
        res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`);
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cache.data);
      }
    }

    // Fetch prices from CoinGecko
    const priceMap = await getTokenPricesBatch(inputSymbols);
    
    const prices: PriceEntry[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < inputSymbols.length; i++) {
      const inputSymbol = inputSymbols[i];
      const canonical = symbols[i];
      const price = priceMap[canonical];
      
      if (typeof price === 'number') {
        prices.push({ symbol: canonical, priceUsd: price, source: 'coingecko' });
      } else {
        warnings.push(`Price not available for ${inputSymbol} (normalized: ${canonical})`);
      }
    }

    const response: SuccessResponse = {
      ok: true,
      ts: new Date().toISOString(),
      prices,
    };

    if (warnings.length > 0) {
      response.warnings = warnings;
    }

    // Cache result
    cache = {
      data: response,
      expires: now + CACHE_TTL_SECONDS * 1000,
    };

    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(response);

  } catch (error) {
    console.error('[api/prices/current] Error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

