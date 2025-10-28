import type { NextApiRequest, NextApiResponse } from 'next'
import { quote } from '../../../src/data/pricing'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const active = Number(req.query.activePools ?? 0)
    const billing = req.query.billingCycle === 'year' ? 'year' : 'month'
    const q = quote(active, billing)

    // Seat/queue toggles via env (UI kan hiermee beslissen welke CTA te tonen)
    const cap = Number(process.env.LL_SEAT_CAP ?? 100)
    const fastforward = (process.env.LL_FASTFORWARD_ENABLED ?? '1') === '1'
    const waitlist = (process.env.LL_WAITLIST_ENABLED ?? '0') === '1'
    // Active seats onbekend zonder DB queries; UI zal /api/early-access/stats gebruiken voor echte aantallen.
    const seats = { cap, active: null as number | null, waitlistEnabled: waitlist, fastforwardEnabled: fastforward }

    res.status(200).json({ ...q, seats })
  } catch (e: unknown) {
    const error = e as Error;
    res.status(200).json({ ok: true, placeholder: true, error: error?.message })
  }
}
