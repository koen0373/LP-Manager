import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const expected = (process.env.PREVIEW_PWD || '').trim()
  const given = (req.body?.password || '').trim()
  const ok = expected && given && expected === given
  if (!ok) return res.status(401).json({ ok:false, error:'Unauthorized' })

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `ll_preview=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60*60*12}${secure}`)
  res.status(200).json({ ok:true })
}
