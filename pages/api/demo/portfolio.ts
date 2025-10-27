import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/src/server/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const address = String(req.query.address || '').toLowerCase()
  if (!address) return res.status(400).json({ ok:false, error: 'address required' })
  try {
    const wallet = await db.analytics_wallet.findUnique({ where: { address } })
    if (!wallet) return res.status(200).json({ ok:true, positions: [], note: 'wallet not in analytics yet' })

    const positions = await db.$queryRawUnsafe<any[]>(`
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
  } catch (e:any) {
    res.status(200).json({ ok:true, placeholder:true, error: e?.message })
  }
}
