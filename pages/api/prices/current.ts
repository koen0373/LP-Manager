import type { NextApiRequest, NextApiResponse } from 'next';

import { getTokenPriceUsd, getTokenPricesBatch } from '@/services/tokenPriceService';

type PriceResponse = {
  success: true;
  prices: Record<string, number>;
};

type ErrorResponse = {
  success: false;
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PriceResponse | ErrorResponse>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const symbolsParam = typeof req.query.symbol === 'string' && req.query.symbol.length
    ? req.query.symbol
    : 'WFLR';

  const symbols = symbolsParam
    .split(',')
    .map((value) => normalizeSymbol(value))
    .filter((value): value is string => Boolean(value));

  if (!symbols.length) {
    return res.status(400).json({ success: false, error: 'No valid symbols provided' });
  }

  let prices: Record<string, number> = {};

  if (symbols.length === 1) {
    const price = await getTokenPriceUsd(symbols[0]);
    if (typeof price === 'number' && Number.isFinite(price)) {
      prices = { [symbols[0]]: price };
    } else {
      prices = {};
    }
  } else {
    prices = await getTokenPricesBatch(symbols);
  }

  return res.status(200).json({ success: true, prices });
}

function normalizeSymbol(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^0-9A-Za-z]/g, '')
    .toUpperCase();
}
