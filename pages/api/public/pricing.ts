import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

type PricingConfig = {
  base5: number;
  extraSlot: number;
  extraBundle5: number;
  alertsPack5: number;
  uiPackCopy: string;
  planId: string;
};

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<PricingConfig | { error: string }>
) {
  if (_req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const configPath = path.join(process.cwd(), 'config', 'pricing.json');
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as PricingConfig;
    
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.status(200).json(config);
  } catch (error) {
    console.error('[api/public/pricing] Failed to load config:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to load pricing config' 
    });
  }
}

