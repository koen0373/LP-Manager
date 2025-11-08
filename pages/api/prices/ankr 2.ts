import type { NextApiRequest, NextApiResponse } from 'next';
import { getAnkrTokenPrice, getAnkrTokenPriceBySymbol, FLARE_TOKEN_ADDRESSES } from '@/lib/ankr/tokenPrice';

/**
 * API endpoint for fetching current token prices via ANKR.
 * 
 * GET /api/prices/ankr?symbol=FXRP
 * GET /api/prices/ankr?address=0xAd552A648C74D49E10027AB8a618A3ad4901c5bE
 * GET /api/prices/ankr (returns FLR native price)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol, address } = req.query;

  try {
    let price: number;

    if (symbol && typeof symbol === 'string') {
      price = await getAnkrTokenPriceBySymbol(symbol);
    } else if (address && typeof address === 'string') {
      price = await getAnkrTokenPrice(address);
    } else {
      // Default: return FLR native price
      price = await getAnkrTokenPrice();
    }

    return res.status(200).json({
      success: true,
      price,
      symbol: symbol || 'FLR',
      address: address || null,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[API /prices/ankr] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch price',
    });
  }
}

