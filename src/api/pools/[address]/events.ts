import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/store/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;
    const { fromTs, toTs, type, limit = '100', offset = '0' } = req.query;
    
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Pool address is required' });
    }

    const poolAddress = address.toLowerCase();
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    // Build where clause
    const where: {
      pool: string;
      timestamp?: { gte: number; lte: number };
      eventName?: string;
    } = { pool: poolAddress };
    
    if (fromTs && toTs) {
      where.timestamp = {
        gte: parseInt(fromTs as string, 10),
        lte: parseInt(toTs as string, 10)
      };
    }
    
    if (type && type !== 'All') {
      where.eventName = type as string;
    }

    const events = await db.poolEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limitNum,
      skip: offsetNum,
    });

    const total = await db.poolEvent.count({ where });

    res.status(200).json({
      events,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total
      }
    });
  } catch (error) {
    console.error('Error fetching pool events:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch pool events' 
    });
  }
}
