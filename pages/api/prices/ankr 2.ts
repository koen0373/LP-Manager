import type { NextApiRequest, NextApiResponse } from 'next';

type DeprecatedResponse = {
  ok: false;
  reason: 'deprecated';
  use: string;
  message: string;
};

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<DeprecatedResponse>
) {
  return res.status(410).json({
    ok: false,
    reason: 'deprecated',
    use: '/api/prices/current',
    message: 'This endpoint has been deprecated. Use /api/prices/current?symbols=SYMBOL1,SYMBOL2 instead. All price data is now sourced via CoinGecko (Flare-only policy).'
  });
}
