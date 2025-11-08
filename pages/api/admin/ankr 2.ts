import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

type Rec = { ts?: string; dayCostUsd?: number; monthCostUsd?: number; totalCalls?: number; lastUpdated?: string };

const FILE = path.join(process.cwd(), 'data', 'ankr_costs.json');

// ASCII-only masker (no Unicode bullets)
const maskKey = (key: string) => (key && key.length > 6 ? `****${key.slice(-6)}` : key || '');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // We operate in Flare-only mode; never call ANKR from here.
  const apiKey = process.env.ANKR_API_KEY || '';
  let data: Rec = {};
  try { if (fs.existsSync(FILE)) data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}

  // Optional force refresh is ignored in Flare-only mode; serve cached file if present.
  res.setHeader('X-Mode', 'flare-only');
  res.setHeader('X-Cache-File', FILE);

  return res.status(200).json({
    ok: true,
    cacheOnly: true,
    apiKeyMasked: maskKey(apiKey),
    data,
    lastUpdateIso: data.lastUpdated || data.ts || null,
  });
}
