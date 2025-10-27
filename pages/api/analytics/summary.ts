import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/src/server/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const [[wallets], [positions], [markets]] = await Promise.all([
      db.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS c FROM "analytics_wallet"`),
      db.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS c FROM "analytics_position"`),
      db.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS c FROM "analytics_market"`)
    ])
    res.status(200).json({
      ok: true,
      counts: { wallets: wallets?.c ?? 0, positions: positions?.c ?? 0, markets: markets?.c ?? 0 }
    })
  } catch (e:any) {
    res.status(200).json({ ok: true, placeholder: true, error: e?.message })
  }
}
