import type { NextApiRequest, NextApiResponse } from 'next';

const FLARESCAN_API = 'https://flare-api.flare.network/ext/C/rpc';

// Rate limiting: track requests per IP
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userRequests = requestCounts.get(ip);

  if (!userRequests || now > userRequests.resetTime) {
    // Reset or initialize
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userRequests.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  userRequests.count++;
  return true;
}

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

  // Rate limiting
  const clientIP = req.headers['x-forwarded-for'] as string || 
                   req.headers['x-real-ip'] as string || 
                   req.connection.remoteAddress || 
                   'unknown';

  if (!checkRateLimit(clientIP)) {
    res.status(429).json({ 
      error: 'Rate limit exceeded. Please wait before making more requests.',
      retryAfter: 60
    });
    return;
  }

  try {
    const { method, params } = req.body;

    if (!method) {
      res.status(400).json({ error: 'Method is required' });
      return;
    }

    console.log('Proxying request to FlareScan:', { method, params });

    // Add delay to prevent overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await fetch(FLARESCAN_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Enosys-LP-Manager/1.0',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params: params || [],
        id: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FlareScan API error:', response.status, errorText);
      
      if (response.status === 429) {
        res.status(429).json({ 
          error: 'FlareScan API rate limit exceeded. Please try again later.',
          retryAfter: 60
        });
        return;
      }
      
      throw new Error(`FlareScan API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      console.error('FlareScan API returned error:', data.error);
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
