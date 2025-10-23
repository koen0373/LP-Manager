import { NextApiRequest, NextApiResponse } from 'next';
import { apyForWindow } from '@/apy/apyFromEvents';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;
    const { fromTs, toTs, token0Usd, token1Usd, feeTierBps } = req.query;
    
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Pool address is required' });
    }

    if (!fromTs || !toTs || !token0Usd || !token1Usd || !feeTierBps) {
      return res.status(400).json({ 
        error: 'Missing required parameters: fromTs, toTs, token0Usd, token1Usd, feeTierBps' 
      });
    }

    const poolAddress = address.toLowerCase();
    const fromTimestamp = parseInt(fromTs as string, 10);
    const toTimestamp = parseInt(toTs as string, 10);
    const token0Price = parseFloat(token0Usd as string);
    const token1Price = parseFloat(token1Usd as string);
    // const feeTier = parseInt(feeTierBps as string, 10);

    const prices = { token0: token0Price, token1: token1Price };
    
    const result = await apyForWindow(
      poolAddress,
      fromTimestamp,
      toTimestamp,
      prices
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Error calculating APY:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to calculate APY' 
    });
  }
}
