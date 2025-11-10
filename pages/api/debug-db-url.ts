import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const dbUrl = process.env.DATABASE_URL || '';
  const parts = dbUrl.split('@');
  const beforeAt = parts[0] || '';
  const afterAt = parts[1] || '';
  
  // Extract password (between last : and @)
  const passwordPart = beforeAt.split(':').pop() || '';
  
  res.status(200).json({
    hasDBUrl: !!dbUrl,
    dbUrlLength: dbUrl.length,
    passwordLength: passwordPart.length,
    passwordHash: passwordPart ? `${passwordPart.substring(0, 8)}...${passwordPart.slice(-4)}` : 'none',
    host: afterAt.split(':')[0] || 'unknown',
    hasRlwy: dbUrl.includes('rlwy.net'),
    hasSslMode: dbUrl.includes('sslmode'),
  });
}

