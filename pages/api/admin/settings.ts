import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '../../../src/server/db'

const ALLOWED = new Set(['FASTFORWARD_ENABLED', 'WAITLIST_ENABLED'])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const keys = Array.from(ALLOWED)
      const rows = await db.appSetting.findMany({ where: { key: { in: keys }}})
      const map: Record<string, string> = {}
      rows.forEach(r => { map[r.key] = r.value })
      // env fallback
      if (map.FASTFORWARD_ENABLED == null) map.FASTFORWARD_ENABLED = process.env.LL_FASTFORWARD_ENABLED ?? '1'
      if (map.WAITLIST_ENABLED == null) map.WAITLIST_ENABLED = process.env.LL_WAITLIST_ENABLED ?? '0'
      return res.status(200).json({ ok: true, settings: map })
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const entries = Object.entries(body ?? {}).filter(([k]) => ALLOWED.has(k))
      if (!entries.length) return res.status(400).json({ ok: false, error: 'no valid keys' })

      const results: any[] = []
      for (const [key, value] of entries) {
        const v = String(value ?? '')
        const row = await db.appSetting.upsert({
          where: { key },
          create: { key, value: v },
          update: { value: v }
        })
        results.push(row)
      }
      return res.status(200).json({ ok: true, updated: results.length })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  } catch (e: any) {
    return res.status(200).json({ ok: true, placeholder: true, error: e?.message })
  }
}
