import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to format Unix timestamp as CET
function formatCET(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  // CET is UTC+1 (winter) or UTC+2 (summer)
  // Simple DST check: March-October is summer time
  const month = date.getUTCMonth();
  const isDST = month >= 2 && month <= 9; // March (2) to October (9)
  const offset = isDST ? 2 : 1;
  const cetDate = new Date(date.getTime() + (offset * 60 * 60 * 1000));
  const tzLabel = offset === 2 ? 'CEST' : 'CET';
  return cetDate.toISOString().replace('T', ' ').substring(0, 19) + ` ${tzLabel}`;
}

type IndexerStats = {
  lastSync: {
    timestamp: string | null;
    blockNumber: number | null;
    eventsCount: number;
  };
  checkpoints: Array<{
    source: string;
    key: string;
    lastBlock: number;
    eventsCount: number;
    updatedAt: string;
  }>;
  recentActivity: {
    eventsLast24h: number;
    eventsLastHour: number;
    latestEvent: string | null;
  };
  status: 'active' | 'stale' | 'inactive';
};

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<IndexerStats | { error: string }>,
) {
  // Set timeout
  res.setTimeout(30000);

  try {
    // Get latest checkpoint (NPM:global)
    const latestCheckpoint = await prisma.$queryRaw<Array<{
      source: string;
      key: string;
      lastBlock: number;
      eventsCount: number;
      updatedAt: Date;
    }>>`
      SELECT 
        "source",
        "key",
        "lastBlock",
        "eventsCount",
        "updatedAt"
      FROM "SyncCheckpoint"
      WHERE "source" = 'NPM' AND "key" = 'global'
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `.catch(() => []);

    const checkpoint = latestCheckpoint[0];

    // Get all recent checkpoints
    const allCheckpoints = await prisma.$queryRaw<Array<{
      source: string;
      key: string;
      lastBlock: number;
      eventsCount: number;
      updatedAt: Date;
    }>>`
      SELECT 
        "source",
        "key",
        "lastBlock",
        "eventsCount",
        "updatedAt"
      FROM "SyncCheckpoint"
      ORDER BY "updatedAt" DESC
      LIMIT 10
    `.catch(() => []);

    // Get recent activity (last 24 hours and last hour)
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - (24 * 60 * 60);
    const oneHourAgo = now - (60 * 60);

    const [events24h, events1h, latestEvent] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count
        FROM "PositionEvent"
        WHERE "timestamp" >= ${oneDayAgo}
      `.catch(() => [{ count: BigInt(0) }]),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count
        FROM "PositionEvent"
        WHERE "timestamp" >= ${oneHourAgo}
      `.catch(() => [{ count: BigInt(0) }]),
      prisma.$queryRaw<Array<{ timestamp: number }>>`
        SELECT MAX("timestamp")::bigint as timestamp
        FROM "PositionEvent"
      `.catch(() => [{ timestamp: null }]),
    ]);

    const eventsLast24h = Number(events24h[0]?.count || 0);
    const eventsLastHour = Number(events1h[0]?.count || 0);
    const latestEventTimestamp = latestEvent[0]?.timestamp ? Number(latestEvent[0].timestamp) : null;

    // Determine status
    let status: 'active' | 'stale' | 'inactive' = 'inactive';
    if (checkpoint) {
      const hoursSinceUpdate = (now - Math.floor(checkpoint.updatedAt.getTime() / 1000)) / 3600;
      if (hoursSinceUpdate < 2) {
        status = 'active';
      } else if (hoursSinceUpdate < 24) {
        status = 'stale';
      }
    }

    const stats: IndexerStats = {
      lastSync: {
        timestamp: checkpoint ? formatCET(Math.floor(checkpoint.updatedAt.getTime() / 1000)) : null,
        blockNumber: checkpoint?.lastBlock || null,
        eventsCount: checkpoint?.eventsCount || 0,
      },
      checkpoints: allCheckpoints.map(cp => ({
        source: cp.source,
        key: cp.key,
        lastBlock: cp.lastBlock,
        eventsCount: cp.eventsCount,
        updatedAt: formatCET(Math.floor(cp.updatedAt.getTime() / 1000)),
      })),
      recentActivity: {
        eventsLast24h,
        eventsLastHour,
        latestEvent: latestEventTimestamp ? formatCET(latestEventTimestamp) : null,
      },
      status,
    };

    return res.status(200).json(stats);
  } catch (error) {
    console.error('[indexer-stats] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

