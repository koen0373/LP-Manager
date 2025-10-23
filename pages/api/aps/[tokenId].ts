import { NextApiRequest, NextApiResponse } from 'next';
import { getClaimableAps } from '@/lib/data/apsRewards';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenId } = req.query;

  if (!tokenId || typeof tokenId !== 'string') {
    return res.status(400).json({ error: 'Token ID is required' });
  }

  try {
    const startTime = Date.now();
    
    // Get APS rewards
    const apsData = await getClaimableAps(tokenId);
    const apsAmount = apsData?.amount || 0;
    const apsPriceUsd = apsData?.priceUsd || 0;
    const apsUsd = apsAmount * apsPriceUsd;

    const duration = Date.now() - startTime;
    console.log(`[API] /api/aps/${tokenId} - Success - ${duration}ms`);

    res.status(200).json({
      tokenId,
      apsAmount,
      apsPriceUsd,
      apsUsd,
      duration
    });
  } catch (error) {
    console.error(`[API] /api/aps/${tokenId} - Error:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch APS rewards',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
