import type { NextApiRequest, NextApiResponse } from 'next';

import { probeBlazeSwapPairs } from '@/lib/providers/blazeswapV2';
import { getPositionCountsWithFallback } from '@/services/positionCountService';

type ProviderHealth = {
  configured: boolean;
  ready: boolean;
  totalPairs?: number | null;
  totalPositions?: number;
};

type HealthResponse = {
  ok: true;
  service: 'liquilab';
  ts: string;
  providers: {
    enosys?: ProviderHealth;
    sparkdex?: ProviderHealth;
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
    // Fetch position counts and BlazeSwap pairs in parallel
    const [positionCounts, blazeswap] = await Promise.all([
      getPositionCountsWithFallback(),
      probeBlazeSwapPairs(),
    ]);

    return res.status(200).json({
      ok: true,
      service: 'liquilab',
      ts: new Date().toISOString(),
      providers: {
        enosys: {
          configured: true,
          ready: positionCounts.enosys > 0,
          totalPositions: positionCounts.enosys,
        },
        sparkdex: {
          configured: true,
          ready: positionCounts.sparkdex > 0,
          totalPositions: positionCounts.sparkdex,
        },
        blazeswap,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/health] failed to evaluate health', message);
    return res.status(500).json({ ok: false, error: message });
  }
}
