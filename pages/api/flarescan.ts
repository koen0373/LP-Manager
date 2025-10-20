import type { NextApiRequest, NextApiResponse } from 'next';

const FLARESCAN_API = 'https://flare-api.flare.network/ext/C/rpc';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { method, params } = req.body;

    if (!method) {
      res.status(400).json({ error: 'Method is required' });
      return;
    }

    console.log('Proxying request to FlareScan:', { method, params });

    const response = await fetch(FLARESCAN_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params: params || [],
        id: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`FlareScan API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`FlareScan API error: ${data.error.message}`);
    }

    console.log('FlareScan response:', data.result);
    res.status(200).json(data.result);
  } catch (error) {
    console.error('FlareScan proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch from FlareScan API',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
