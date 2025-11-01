import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/server/db'

const DEPRECATION_INTERVAL_MS = 60_000;
let lastDeprecationLog = 0;

function logDeprecation() {
  const now = Date.now();
  if (now - lastDeprecationLog > DEPRECATION_INTERVAL_MS) {
    lastDeprecationLog = now;
    console.warn('[api/demo/portfolio] Deprecated endpoint – migrate to /api/positions.');
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  logDeprecation();

  const address = String(req.query.address || '').toLowerCase()
  if (!address) return res.status(400).json({ ok:false, error: 'address required' })
  try {
    const wallet = await prisma.analytics_wallet.findUnique({ where: { address } })
    if (!wallet) return res.status(200).json({ ok:true, positions: [], note: 'wallet not in analytics yet' })

    type PositionRow = {
      onchainId: string;
      providerSlug: string;
      marketId: string;
      token0Symbol: string;
      token1Symbol: string;
      tvlUsd: number;
      feesUsd: number;
      incentivesUsd: number;
      inRange: boolean;
      ts: Date;
    };

    const positions = await prisma.$queryRawUnsafe<PositionRow[]>(`
      SELECT p.onchainId, m.providerSlug, m.marketId, m.token0Symbol, m.token1Symbol,
             s.tvlUsd, s.feesUsd, s.incentivesUsd, s.inRange, s.ts
      FROM analytics_position p
      JOIN analytics_market m ON m.id = p."marketIdFk"
      JOIN LATERAL (
        SELECT * FROM analytics_position_snapshot s
        WHERE s."positionIdFk" = p.id
        ORDER BY s.ts DESC
        LIMIT 1
      ) s ON true
      WHERE p."walletId" = $1
      ORDER BY s.ts DESC
    `, wallet.id)

    res.status(200).json({ ok:true, positions })
  } catch (e: unknown) {
    const error = e as Error;
    res.status(200).json({ ok:true, placeholder:true, error: error?.message })
  }
}
