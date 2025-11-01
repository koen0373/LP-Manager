import type { NextApiRequest, NextApiResponse } from 'next';

import { probeBlazeSwapPairs } from '@/lib/providers/blazeswapV2';

type ProviderHealth = {
  configured: boolean;
  ready: boolean;
  totalPairs: number | null;
};

type HealthResponse = {
  ok: true;
  service: 'liquilab';
  ts: string;
  providers: {
    blazeswap: ProviderHealth;
  };
};

type ErrorResponse = {
  ok: false;
  error: string;
};

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<HealthResponse | ErrorResponse>,
) {
  try {
    const blazeswap = await probeBlazeSwapPairs();

    return res.status(200).json({
      ok: true,
      service: 'liquilab',
      ts: new Date().toISOString(),
      providers: {
        blazeswap,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/health] failed to evaluate health', message);
    return res.status(500).json({ ok: false, error: message });
  }
}
