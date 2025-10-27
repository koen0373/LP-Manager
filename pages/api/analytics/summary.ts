import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/server/db'

type CountResult = { c: number };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const [[wallets], [positions], [markets]] = await Promise.all([
      prisma.$queryRawUnsafe<CountResult[]>(`SELECT COUNT(*)::int AS c FROM "analytics_wallet"`),
      prisma.$queryRawUnsafe<CountResult[]>(`SELECT COUNT(*)::int AS c FROM "analytics_position"`),
      prisma.$queryRawUnsafe<CountResult[]>(`SELECT COUNT(*)::int AS c FROM "analytics_market"`)
    ])
    res.status(200).json({
      ok: true,
      counts: { wallets: wallets?.c ?? 0, positions: positions?.c ?? 0, markets: markets?.c ?? 0 }
    })
  } catch (e: unknown) {
    const error = e as Error;
    res.status(200).json({ ok: true, placeholder: true, error: error?.message })
  }
}
