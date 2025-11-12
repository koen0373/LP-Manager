import type { NextApiRequest, NextApiResponse } from 'next';

import { getTokenPriceUsd, getTokenPricesBatch } from '@/services/tokenPriceService';

type PriceResponse = {
  prices: Record<string, number>;
  asOf: string;
};

type ErrorResponse = {
  error: string;
};

function normalizeParam(value?: string | string[]) {
  if (!value) return [] as string[];
  if (Array.isArray(value)) return value;
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PriceResponse | ErrorResponse>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol, address } = req.query;
  const symbols = normalizeParam(symbol).map((value) => value.toUpperCase());
  const addresses = normalizeParam(address);

  if (!symbols.length && !addresses.length) {
    return res.status(400).json({ error: 'symbol or address required' });
  }

  if (addresses.length) {
    return res.status(400).json({ error: 'address lookup not supported; provide token symbols' });
  }

  try {
    const response: Record<string, number> = {};
    if (symbols.length === 1) {
      const price = await getTokenPriceUsd(symbols[0]);
      if (typeof price === 'number') {
        response[symbols[0]] = price;
      }
    } else if (symbols.length > 1) {
      const batch = await getTokenPricesBatch(symbols);
      for (const sym of symbols) {
        if (typeof batch[sym] === 'number') {
          response[sym] = batch[sym];
        }
      }
    }

    if (!Object.keys(response).length) {
      return res.status(404).json({ error: 'No prices found for requested symbols' });
    }

    return res.status(200).json({
      prices: response,
      asOf: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/enrich/price] failed', message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
