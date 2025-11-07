import type { NextApiRequest, NextApiResponse } from 'next';
import { getWalletBalances, FLARE_TOKENS } from '@/lib/ankr/provider';

/**
 * Get wallet token balances with USD values via ANKR SDK
 * 
 * GET /api/wallet/balances?address=0x...
 * GET /api/wallet/balances?address=0x...&chains=flare,eth,bsc
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address, chains } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ 
      error: 'Missing required parameter: address',
      example: '/api/wallet/balances?address=0x...' 
    });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid address format' });
  }

  try {
    const blockchains = chains && typeof chains === 'string' 
      ? chains.split(',').map(c => c.trim())
      : ['flare'];

    const balances = await getWalletBalances(address, blockchains);

    return res.status(200).json({
      success: true,
      address,
      blockchains,
      balances,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[API /wallet/balances] Error:', error);
    
    // Handle ANKR API errors gracefully
    if (error instanceof Error && error.message.includes('403')) {
      return res.status(503).json({
        success: false,
        error: 'ANKR Advanced API not available. Using fallback methods.',
        hint: 'Sign up for ANKR Advanced API at https://www.ankr.com/rpc/advanced-api/',
      });
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch balances',
    });
  }
}

