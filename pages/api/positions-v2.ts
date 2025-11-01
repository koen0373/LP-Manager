import type { NextApiRequest, NextApiResponse } from 'next';

const SUNSET_DATE = '2025-11-14';

function buildRedirectLocation(req: NextApiRequest) {
  const params = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    } else if (value !== undefined) {
      params.append(key, value);
    }
  });

  const query = params.toString();
  return `/api/positions${query ? `?${query}` : ''}`;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const location = buildRedirectLocation(req);
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', SUNSET_DATE);
  res.setHeader('Warning', '299 - "Use /api/positions"');
  res.setHeader('Location', location);
  res.status(307).end();
}

