import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to add timeout to Prisma queries
function withQueryTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
    }),
  ]);
}

type EnrichmentStats = {
  poolAttribution: {
    totalUnknown: number;
    totalPositions: number;
    percentageUnknown: number;
    recentResolved: number; // Last 24h
  };
  feesUsd: {
    totalCollectEvents: number;
    withoutUsdValue: number;
    withUsdValue: number;
    percentageComplete: number;
    recentCalculated: number; // Last 24h
  };
  rangeStatus: {
    totalPositions: number;
    withRangeStatus: number;
    inRange: number;
    outOfRange: number;
    percentageComplete: number;
    recentCalculated: number; // Last 24h
  };
  lastUpdated: string;
};

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<EnrichmentStats | { error: string }>,
) {
  // Set a longer timeout for this endpoint
  res.setTimeout(30000); // 30 seconds

  try {
    const now = Date.now();
    const oneDayAgo = Math.floor((now - 24 * 60 * 60 * 1000) / 1000);

    // Wrap all queries with timeout (5 seconds each)
    const queryTimeout = 5000;

    console.log('[enrichment-stats] Starting queries...');

    // Pool Attribution Stats - Simplified queries
    const [totalUnknown, totalPositions] = await Promise.all([
      withQueryTimeout(
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT "tokenId")::bigint as count
          FROM "PositionEvent"
          WHERE "pool" = 'unknown';
        `,
        queryTimeout
      ).catch((e) => {
        console.error('[enrichment-stats] totalUnknown query failed:', e);
        return [{ count: BigInt(0) }];
      }),
      withQueryTimeout(
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT "tokenId")::bigint as count
          FROM "PositionEvent";
        `,
        queryTimeout
      ).catch((e) => {
        console.error('[enrichment-stats] totalPositions query failed:', e);
        return [{ count: BigInt(0) }];
      }),
    ]);

    console.log('[enrichment-stats] Pool attribution queries complete');

    const unknownCount = Number(totalUnknown[0]?.count || 0);
    const totalCount = Number(totalPositions[0]?.count || 0);

    // Recent resolved - simplified
    const recentResolved = await withQueryTimeout(
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT "tokenId")::bigint as count
        FROM "PositionEvent"
        WHERE "pool" != 'unknown'
          AND "pool" IS NOT NULL
          AND "timestamp" >= ${oneDayAgo};
      `,
      queryTimeout
    ).catch((e) => {
      console.error('[enrichment-stats] recentResolved query failed:', e);
      return [{ count: BigInt(0) }];
    });

    console.log('[enrichment-stats] Recent resolved query complete');

    // Fees USD Stats - Simplified
    const [totalCollect, withoutUsd, withUsd] = await Promise.all([
      withQueryTimeout(
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint as count
          FROM "PositionEvent"
          WHERE "eventType" = 'COLLECT';
        `,
        queryTimeout
      ).catch((e) => {
        console.error('[enrichment-stats] totalCollect query failed:', e);
        return [{ count: BigInt(0) }];
      }),
      withQueryTimeout(
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint as count
          FROM "PositionEvent"
          WHERE "eventType" = 'COLLECT'
            AND ("usdValue" IS NULL OR "usdValue" = 0);
        `,
        queryTimeout
      ).catch((e) => {
        console.error('[enrichment-stats] withoutUsd query failed:', e);
        return [{ count: BigInt(0) }];
      }),
      withQueryTimeout(
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint as count
          FROM "PositionEvent"
          WHERE "eventType" = 'COLLECT'
            AND "usdValue" IS NOT NULL
            AND "usdValue" > 0;
        `,
        queryTimeout
      ).catch((e) => {
        console.error('[enrichment-stats] withUsd query failed:', e);
        return [{ count: BigInt(0) }];
      }),
    ]);

    console.log('[enrichment-stats] Fees USD queries complete');

    const totalCollectCount = Number(totalCollect[0]?.count || 0);
    const withoutUsdCount = Number(withoutUsd[0]?.count || 0);
    const withUsdCount = Number(withUsd[0]?.count || 0);

    // Recent calculated
    const recentCalculated = await withQueryTimeout(
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count
        FROM "PositionEvent"
        WHERE "eventType" = 'COLLECT'
          AND "usdValue" IS NOT NULL
          AND "usdValue" > 0
          AND "timestamp" >= ${oneDayAgo};
      `,
      queryTimeout
    ).catch((e) => {
      console.error('[enrichment-stats] recentCalculated query failed:', e);
      return [{ count: BigInt(0) }];
    });

    console.log('[enrichment-stats] Recent calculated query complete');

    // Range Status Stats - Simplified
    const [totalPositionsForRange, withRangeStatus, inRange, outOfRange] = await Promise.all([
      withQueryTimeout(
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT "tokenId")::bigint as count
          FROM "PositionEvent"
          WHERE "pool" != 'unknown'
            AND "pool" IS NOT NULL;
        `,
        queryTimeout
      ).catch((e) => {
        console.error('[enrichment-stats] totalPositionsForRange query failed:', e);
        return [{ count: BigInt(0) }];
      }),
      withQueryTimeout(
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT "tokenId")::bigint as count
          FROM "PositionEvent"
          WHERE "tickLower" IS NOT NULL
            AND "tickUpper" IS NOT NULL
            AND "tick" IS NOT NULL;
        `,
        queryTimeout
      ).catch((e) => {
        console.error('[enrichment-stats] withRangeStatus query failed:', e);
        return [{ count: BigInt(0) }];
      }),
      withQueryTimeout(
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT "tokenId")::bigint as count
          FROM "PositionEvent"
          WHERE "metadata"->>'rangeStatus' = 'IN_RANGE';
        `,
        queryTimeout
      ).catch((e) => {
        console.error('[enrichment-stats] inRange query failed:', e);
        return [{ count: BigInt(0) }];
      }),
      withQueryTimeout(
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT "tokenId")::bigint as count
          FROM "PositionEvent"
          WHERE "metadata"->>'rangeStatus' = 'OUT_OF_RANGE';
        `,
        queryTimeout
      ).catch((e) => {
        console.error('[enrichment-stats] outOfRange query failed:', e);
        return [{ count: BigInt(0) }];
      }),
    ]);

    console.log('[enrichment-stats] Range status queries complete');

    const totalPositionsForRangeCount = Number(totalPositionsForRange[0]?.count || 0);
    const withRangeStatusCount = Number(withRangeStatus[0]?.count || 0);
    const inRangeCount = Number(inRange[0]?.count || 0);
    const outOfRangeCount = Number(outOfRange[0]?.count || 0);

    // Recent calculated
    const recentRangeCalculated = await withQueryTimeout(
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT "tokenId")::bigint as count
        FROM "PositionEvent"
        WHERE "tickLower" IS NOT NULL
          AND "tickUpper" IS NOT NULL
          AND "tick" IS NOT NULL
          AND "timestamp" >= ${oneDayAgo};
      `,
      queryTimeout
    ).catch((e) => {
      console.error('[enrichment-stats] recentRangeCalculated query failed:', e);
      return [{ count: BigInt(0) }];
    });

    console.log('[enrichment-stats] All queries complete, building response...');

    const stats: EnrichmentStats = {
      poolAttribution: {
        totalUnknown: unknownCount,
        totalPositions: totalCount,
        percentageUnknown: totalCount > 0 ? (unknownCount / totalCount) * 100 : 0,
        recentResolved: Number(recentResolved[0]?.count || 0),
      },
      feesUsd: {
        totalCollectEvents: totalCollectCount,
        withoutUsdValue: withoutUsdCount,
        withUsdValue: withUsdCount,
        percentageComplete: totalCollectCount > 0 ? (withUsdCount / totalCollectCount) * 100 : 0,
        recentCalculated: Number(recentCalculated[0]?.count || 0),
      },
      rangeStatus: {
        totalPositions: totalPositionsForRangeCount,
        withRangeStatus: withRangeStatusCount,
        inRange: inRangeCount,
        outOfRange: outOfRangeCount,
        percentageComplete: totalPositionsForRangeCount > 0 ? (withRangeStatusCount / totalPositionsForRangeCount) * 100 : 0,
        recentCalculated: Number(recentRangeCalculated[0]?.count || 0),
      },
      lastUpdated: new Date().toISOString(),
    };

    console.log('[enrichment-stats] Response built, sending...');
    return res.status(200).json(stats);
  } catch (error) {
    console.error('[enrichment-stats] Fatal error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await prisma.$disconnect().catch(() => {
      // Ignore disconnect errors
    });
  }
}
