import type { NextApiRequest, NextApiResponse } from 'next';
import pricingConfig from '@/config/pricing.json';

/**
 * Public pricing API endpoint
 * 
 * Returns pricing configuration as read-only JSON.
 * Cached for 1 hour to reduce load.
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set cache headers
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.setHeader('Content-Type', 'application/json');

  // Return pricing config as read-only JSON
  return res.status(200).json(pricingConfig);
}

