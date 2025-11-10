/**
 * On-Demand Price Enrichment API
 * 
 * Fetches token prices from CoinGecko with caching (1 hour)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { cacheKeys, priceCache } from '../../src/lib/enrichmentCache';

// Lazy load tokenPriceService to avoid import issues
async function getTokenPriceService() {
  const module = await import('../../src/services/tokenPriceService');
  return module.tokenPriceService;
}

/**
 * GET /api/enrich/price/:symbol
 * Get token price with caching
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Token symbol required' });
  }

  try {
    const cacheKey = cacheKeys.price(symbol);
    
    // Check cache first
    const cached = priceCache.get<number>(cacheKey);
    if (cached !== null) {
      return res.status(200).json({
        symbol: symbol.toUpperCase(),
        price: cached,
        cached: true,
      });
    }

    // Fetch from CoinGecko
    const tokenPriceService = await getTokenPriceService();
    const price = await tokenPriceService.getTokenPrice(symbol);

    if (price === null) {
      return res.status(404).json({ error: 'Price not found' });
    }

    // Cache for 1 hour
    priceCache.set(cacheKey, price, 3600);

    return res.status(200).json({
      symbol: symbol.toUpperCase(),
      price,
      cached: false,
    });
  } catch (error) {
    console.error('[enrich-price] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

