/**
 * API-Based Incentives Fetcher (Enosys rFLR)
 * 
 * Gebruikt bestaande rFLR API om rewards per positie op te halen
 * en aggregeert dit naar pool-level incentives.
 * 
 * Usage:
 *   npm run indexer:incentives:api
 */

import { PrismaClient } from '@prisma/client';
import { getRflrRewardForPosition } from '../src/services/rflrRewards';

const prisma = new PrismaClient();

const RFLR_PRICE_USD = 0.016; // rFLR ≈ $0.016 (update via price API later)

async function main() {
  console.log('[APIIncentivesFetcher] Starting Enosys rFLR aggregation...');

  // 1. Get all active Enosys positions from PositionEvent
  const enosysPositions = await prisma.positionEvent.findMany({
    where: {
      pool: {
        in: await getEnosysPools(),
      },
      eventType: { in: ['MINT', 'INCREASE'] },
    },
    distinct: ['tokenId'],
    select: {
      tokenId: true,
      pool: true,
    },
  });

  console.log(`[APIIncentivesFetcher] Found ${enosysPositions.length} Enosys positions`);

  // 2. Fetch rFLR rewards per position via API
  const poolRewardsMap = new Map<string, { totalRflr: number; positionCount: number }>();

  for (const position of enosysPositions) {
    try {
      const rflrReward = await getRflrRewardForPosition(position.tokenId);
      
      if (rflrReward && rflrReward > 0) {
        const poolData = poolRewardsMap.get(position.pool) || { totalRflr: 0, positionCount: 0 };
        poolData.totalRflr += rflrReward;
        poolData.positionCount += 1;
        poolRewardsMap.set(position.pool, poolData);
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 50));
    } catch (err) {
      console.warn(`[APIIncentivesFetcher] Failed to fetch rFLR for position ${position.tokenId}:`, err);
    }
  }

  console.log(`[APIIncentivesFetcher] Aggregated rFLR for ${poolRewardsMap.size} pools`);

  // 3. Convert to per-day rewards (rFLR API returns total claimable, we estimate daily rate)
  // Assumption: rewards accumulate linearly, estimate daily rate from current claimable amount
  // Better approach: track delta over 24h, but for MVP we use a fixed daily rate estimate

  const DAILY_RATE_ESTIMATE = 0.05; // Assume 5% of claimable amount accrues per day

  for (const [poolAddress, data] of poolRewardsMap) {
    const avgRflrPerPosition = data.totalRflr / data.positionCount;
    const estimatedDailyRflr = avgRflrPerPosition * DAILY_RATE_ESTIMATE * data.positionCount;
    const estimatedDailyUsd = estimatedDailyRflr * RFLR_PRICE_USD;

    console.log(
      `[APIIncentivesFetcher] ${poolAddress}: ${estimatedDailyRflr.toFixed(2)} rFLR/day ($${estimatedDailyUsd.toFixed(2)}) — ${data.positionCount} positions`
    );

    // 4. Upsert into PoolIncentive table
    await prisma.poolIncentive.upsert({
      where: {
        poolAddress_rewardToken_startDate: {
          poolAddress,
          rewardToken: '0x0000000000000000000000000000000000000000', // Placeholder for rFLR
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        },
      },
      create: {
        poolAddress,
        dex: 'enosys-v3',
        rewardToken: '0x0000000000000000000000000000000000000000',
        rewardTokenSymbol: 'rFLR',
        rewardPerDay: estimatedDailyRflr.toString(),
        rewardUsdPerDay: estimatedDailyUsd.toString(),
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        sourceType: 'api',
        isActive: true,
        verified: false, // API-derived, needs manual verification
      },
      update: {
        rewardPerDay: estimatedDailyRflr.toString(),
        rewardUsdPerDay: estimatedDailyUsd.toString(),
        updatedAt: new Date(),
      },
    });
  }

  console.log('[APIIncentivesFetcher] Done! rFLR incentives updated in PoolIncentive table.');
}

/**
 * Get all Enosys pool addresses from Pool table
 */
async function getEnosysPools(): Promise<string[]> {
  const ENOSYS_FACTORY = '0x0dCd35B6B459cFd2998cBb22e863a7F632bAE4ec'.toLowerCase();
  
  const pools = await prisma.pool.findMany({
    where: { factory: ENOSYS_FACTORY },
    select: { address: true },
  });

  return pools.map((p) => p.address);
}

main()
  .catch((err) => {
    console.error('[APIIncentivesFetcher] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });

