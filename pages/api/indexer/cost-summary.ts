import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/indexer/cost-summary
 * 
 * Returns ANKR cost metrics from the last indexer runs
 * (parsed from SyncCheckpoint metadata if stored, or live calculation)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get recent checkpoints to estimate activity
    const checkpoints = await prisma.syncCheckpoint.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    // Mock cost calculation based on recent activity
    // In production, you'd store actual cost metrics in DB or read from logs
    const totalEvents = checkpoints.reduce((sum, cp) => sum + (cp.eventsCount || 0), 0);
    
    // Rough estimate: 1 event ≈ 0.3 getLogs calls
    const estimatedGetLogs = Math.ceil(totalEvents * 0.3);
    const estimatedBlockNumber = checkpoints.length * 2; // 2 per checkpoint
    
    const creditsGetLogs = estimatedGetLogs * 20;
    const creditsBlockNumber = estimatedBlockNumber * 1;
    const totalCredits = creditsGetLogs + creditsBlockNumber;
    const usdEstimate = totalCredits / 10_000_000;

    const summary = {
      period: '24h',
      totalCredits,
      usdEstimate: parseFloat(usdEstimate.toFixed(6)),
      byMethod: {
        eth_getLogs: {
          count: estimatedGetLogs,
          credits: creditsGetLogs,
          costPerCall: 20,
        },
        eth_blockNumber: {
          count: estimatedBlockNumber,
          credits: creditsBlockNumber,
          costPerCall: 1,
        },
      },
      checkpoints: checkpoints.map((cp) => ({
        id: cp.id,
        lastBlock: cp.lastBlock,
        eventsCount: cp.eventsCount,
        updatedAt: cp.updatedAt.toISOString(),
      })),
      rateInfo: {
        creditPerUsd: 10_000_000,
        formula: '10M credits = $1 USD',
      },
    };

    res.status(200).json(summary);
  } catch (error) {
    console.error('[api/indexer/cost-summary] Error:', error);
    res.status(500).json({ error: 'Failed to fetch cost summary' });
  }
}

