import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DB_DISABLE = process.env.DB_DISABLE === 'true';

export interface AnalyticsResponse<T> {
  ok: boolean;
  degrade: boolean;
  ts: string;
  data?: T;
  reason?: string;
}

async function checkMVExists(name: string): Promise<boolean> {
  if (DB_DISABLE) return false;
  try {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_matviews WHERE matviewname = ${name}
      ) as exists
    `;
    return result[0]?.exists ?? false;
  } catch {
    return false;
  }
}

export async function getNetworkSummary(): Promise<AnalyticsResponse<{
  pools_total: number;
  tvl_estimate: number;
  positions_total: number;
  fees_24h: number;
  fees_7d: number;
}>> {
  if (DB_DISABLE) {
    return {
      ok: false,
      degrade: true,
      ts: new Date().toISOString(),
      reason: 'DB_DISABLE=true',
    };
  }

  try {
    const [poolsCount, positionsCount, fees24h, fees7d] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT "pool")::bigint as count FROM "PoolEvent"
      `.catch(() => [{ count: BigInt(0) }]),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT "tokenId")::bigint as count FROM "PositionEvent"
      `.catch(() => [{ count: BigInt(0) }]),
      checkMVExists('mv_pool_fees_24h').then(async (exists) => {
        if (!exists) return { fees: 0 };
        const result = await prisma.$queryRaw<Array<{ fees: number }>>`
          SELECT COALESCE(SUM(CAST("amount0" AS NUMERIC) + CAST("amount1" AS NUMERIC)), 0) as fees
          FROM "mv_pool_fees_24h"
        `.catch(() => [{ fees: 0 }]);
        return result[0] || { fees: 0 };
      }),
      checkMVExists('mv_pool_fees_7d').then(async (exists) => {
        if (!exists) return { fees: 0 };
        const result = await prisma.$queryRaw<Array<{ fees: number }>>`
          SELECT COALESCE(SUM(CAST("fees0" AS NUMERIC) + CAST("fees1" AS NUMERIC)), 0) as fees
          FROM "mv_pool_fees_7d"
        `.catch(() => [{ fees: 0 }]);
        return result[0] || { fees: 0 };
      }),
    ]);

    const mvFees24hExists = await checkMVExists('mv_pool_fees_24h');
    const mvFees7dExists = await checkMVExists('mv_pool_fees_7d');

    return {
      ok: true,
      degrade: !mvFees24hExists || !mvFees7dExists,
      ts: new Date().toISOString(),
      data: {
        pools_total: Number(poolsCount[0]?.count || 0),
        tvl_estimate: 0, // TODO: calculate from positions
        positions_total: Number(positionsCount[0]?.count || 0),
        fees_24h: fees24h.fees || 0,
        fees_7d: fees7d.fees || 0,
      },
      reason: (!mvFees24hExists || !mvFees7dExists) ? 'mv_missing' : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      degrade: true,
      ts: new Date().toISOString(),
      reason: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}

export async function getPoolAnalytics(poolId: string): Promise<AnalyticsResponse<{
  pool: string;
  fees_24h: number;
  fees_7d: number;
  positions_count: number;
  volume_7d: number;
}>> {
  if (DB_DISABLE) {
    return {
      ok: false,
      degrade: true,
      ts: new Date().toISOString(),
      reason: 'DB_DISABLE=true',
    };
  }

  try {
    const poolExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM "PoolEvent" WHERE "pool" = ${poolId} LIMIT 1) as exists
    `.catch(() => [{ exists: false }]);

    if (!poolExists[0]?.exists) {
      return {
        ok: false,
        degrade: false,
        ts: new Date().toISOString(),
        reason: 'pool_not_found',
      };
    }

    const [fees24h, fees7d, positionsCount, volume7d] = await Promise.all([
      checkMVExists('mv_pool_fees_24h').then(async (exists) => {
        if (!exists) return { fees: 0 };
        const result = await prisma.$queryRaw<Array<{ fees: number }>>`
          SELECT COALESCE(CAST("amount0" AS NUMERIC) + CAST("amount1" AS NUMERIC), 0) as fees
          FROM "mv_pool_fees_24h"
          WHERE "pool" = ${poolId}
        `.catch(() => [{ fees: 0 }]);
        return result[0] || { fees: 0 };
      }),
      checkMVExists('mv_pool_fees_7d').then(async (exists) => {
        if (!exists) return { fees: 0 };
        const result = await prisma.$queryRaw<Array<{ fees: number }>>`
          SELECT COALESCE(CAST("fees0" AS NUMERIC) + CAST("fees1" AS NUMERIC), 0) as fees
          FROM "mv_pool_fees_7d"
          WHERE "pool" = ${poolId}
        `.catch(() => [{ fees: 0 }]);
        return result[0] || { fees: 0 };
      }),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT "tokenId")::bigint as count
        FROM "PositionEvent"
        WHERE "pool" = ${poolId}
      `.catch(() => [{ count: BigInt(0) }]),
      checkMVExists('mv_pool_volume_7d').then(async (exists) => {
        if (!exists) return { volume: 0 };
        const result = await prisma.$queryRaw<Array<{ volume: number }>>`
          SELECT COALESCE(CAST("volume0" AS NUMERIC) + CAST("volume1" AS NUMERIC), 0) as volume
          FROM "mv_pool_volume_7d"
          WHERE "pool" = ${poolId}
        `.catch(() => [{ volume: 0 }]);
        return result[0] || { volume: 0 };
      }),
    ]);

    const mvFees24hExists = await checkMVExists('mv_pool_fees_24h');
    const mvFees7dExists = await checkMVExists('mv_pool_fees_7d');
    const mvVolume7dExists = await checkMVExists('mv_pool_volume_7d');

    return {
      ok: true,
      degrade: !mvFees24hExists || !mvFees7dExists || !mvVolume7dExists,
      ts: new Date().toISOString(),
      data: {
        pool: poolId,
        fees_24h: fees24h.fees || 0,
        fees_7d: fees7d.fees || 0,
        positions_count: Number(positionsCount[0]?.count || 0),
        volume_7d: volume7d.volume || 0,
      },
      reason: (!mvFees24hExists || !mvFees7dExists || !mvVolume7dExists) ? 'mv_missing' : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      degrade: true,
      ts: new Date().toISOString(),
      reason: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}

export async function disconnect() {
  await prisma.$disconnect();
}


