import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/server/db';
import { calculatePositionValue } from '@/utils/poolHelpers';
import { getTokenPriceWithFallback } from '@/services/tokenPriceService';

interface TVLResponse {
  success: boolean;
  data?: {
    totalTVL: number;
    enosysTVL: number;
    sparkdexTVL: number;
    positionCount: {
      total: number;
      enosys: number;
      sparkdex: number;
    };
    avgPositionValue: {
      total: number;
      enosys: number;
      sparkdex: number;
    };
    calculatedAt: string;
    priceSource: string;
  };
  error?: string;
}

const ENOSYS_NFPM = '0xd9770b1c7a6ccd33c75b5bcb1c0078f46be46657';
const SPARKDEX_NFPM = '0xee5ff5bc5f852764b5584d92a4d592a53dc527da';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TVLResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    console.log('[TVL API] Fetching all positions from database...');

    // Fetch all active positions with pool data
    // Use a more efficient query that groups by pool first
    const poolSummary = await prisma.$queryRaw<Array<{
      pool: string;
      nfpmAddress: string;
      token0Symbol: string;
      token1Symbol: string;
      token0Decimals: number;
      token1Decimals: number;
      positionCount: bigint;
      totalAmount0: string;
      totalAmount1: string;
    }>>`
      SELECT 
        pe.pool,
        pt."nfpmAddress",
        p."token0Symbol",
        p."token1Symbol",
        p."token0Decimals",
        p."token1Decimals",
        COUNT(DISTINCT pe."tokenId") as "positionCount",
        SUM(CAST(pe.amount0 AS NUMERIC)) as "totalAmount0",
        SUM(CAST(pe.amount1 AS NUMERIC)) as "totalAmount1"
      FROM "PositionEvent" pe
      JOIN "PositionTransfer" pt ON pt."tokenId" = pe."tokenId"
      JOIN "Pool" p ON p.address = pe.pool
      WHERE pe.event = 'IncreaseLiquidity'
        AND pe.pool IS NOT NULL
        AND pe.pool != 'unknown'
        AND pt."to" != '0x0000000000000000000000000000000000000000'
        AND pt."nfpmAddress" IS NOT NULL
      GROUP BY pe.pool, pt."nfpmAddress", p."token0Symbol", p."token1Symbol", 
               p."token0Decimals", p."token1Decimals";
    `;

    console.log(`[TVL API] Found ${poolSummary.length} active pools`);

    let totalTVL = 0;
    let enosysTVL = 0;
    let sparkdexTVL = 0;
    let enosysCount = 0;
    let sparkdexCount = 0;

    // Process each pool (fewer API calls than per-position)
    for (const pool of poolSummary) {
      try {
        const amount0 = BigInt(pool.totalAmount0 || '0');
        const amount1 = BigInt(pool.totalAmount1 || '0');
        
        if (amount0 === 0n || amount1 === 0n) {
          continue; // Skip pools with no liquidity
        }

        // Calculate pool price ratio
        const poolPrice = Number(amount1) / Number(amount0);

        // Get USD prices for both tokens (with caching, so repeat calls are fast)
        const token0PriceUsd = await getTokenPriceWithFallback(
          pool.token0Symbol,
          1 / poolPrice
        );

        const token1PriceUsd = await getTokenPriceWithFallback(
          pool.token1Symbol,
          poolPrice
        );

        // Calculate pool TVL
        const amount0Adjusted = Number(amount0) / Math.pow(10, pool.token0Decimals);
        const amount1Adjusted = Number(amount1) / Math.pow(10, pool.token1Decimals);

        const poolTVL = 
          (amount0Adjusted * token0PriceUsd) + 
          (amount1Adjusted * token1PriceUsd);

        // Add to totals
        totalTVL += poolTVL;

        const posCount = Number(pool.positionCount);

        if (pool.nfpmAddress.toLowerCase() === ENOSYS_NFPM) {
          enosysTVL += poolTVL;
          enosysCount += posCount;
        } else if (pool.nfpmAddress.toLowerCase() === SPARKDEX_NFPM) {
          sparkdexTVL += poolTVL;
          sparkdexCount += posCount;
        }
      } catch (error) {
        console.warn(`[TVL API] Failed to calculate TVL for pool ${pool.pool}:`, error);
        // Continue with other pools
      }
    }

    const totalCount = enosysCount + sparkdexCount;

    console.log(`[TVL API] Total TVL: $${(totalTVL / 1e6).toFixed(2)}M`);
    console.log(`[TVL API] Enosys TVL: $${(enosysTVL / 1e6).toFixed(2)}M (${enosysCount} positions)`);
    console.log(`[TVL API] SparkDEX TVL: $${(sparkdexTVL / 1e6).toFixed(2)}M (${sparkdexCount} positions)`);

    return res.status(200).json({
      success: true,
      data: {
        totalTVL,
        enosysTVL,
        sparkdexTVL,
        positionCount: {
          total: totalCount,
          enosys: enosysCount,
          sparkdex: sparkdexCount,
        },
        avgPositionValue: {
          total: totalCount > 0 ? totalTVL / totalCount : 0,
          enosys: enosysCount > 0 ? enosysTVL / enosysCount : 0,
          sparkdex: sparkdexCount > 0 ? sparkdexTVL / sparkdexCount : 0,
        },
        calculatedAt: new Date().toISOString(),
        priceSource: 'CoinGecko API + pool ratios',
      },
    });
  } catch (error) {
    console.error('[TVL API] Error calculating TVL:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

