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

const prisma = new PrismaClient();

const RFLR_API_BASE_URL = 'https://v3.dex.enosys.global/api/flr/v2/stats/rflr';
const RFLR_PRICE_USD = 0.016; // rFLR ≈ $0.016 (update via price API later)

/**
 * Fetch rFLR reward for a single position via Enosys API
 */
async function getRflrReward(positionId: string): Promise<number | null> {
  try {
    const response = await fetch(`${RFLR_API_BASE_URL}/${positionId}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const reward = await response.json();
    const numericReward = typeof reward === 'number' ? reward : Number(reward);

    return Number.isFinite(numericReward) ? numericReward : null;
  } catch (error) {
    return null;
  }
}

async function main() {
  console.log('[APIIncentivesFetcher] Starting Enosys rFLR aggregation...');

  const ENOSYS_NFPM = '0xd9770b1c7a6ccd33c75b5bcb1c0078f46be46657'.toLowerCase();

  // 1. Get all unique Enosys positions from PositionTransfer
  const enosysPositions = await prisma.positionTransfer.findMany({
    where: {
      nfpmAddress: ENOSYS_NFPM,
    },
    distinct: ['tokenId'],
    select: {
      tokenId: true,
    },
    take: 50, // Sample first 50 positions for quick test
  });

  console.log(`[APIIncentivesFetcher] Found ${enosysPositions.length} Enosys positions`);

  if (enosysPositions.length === 0) {
    console.log('[APIIncentivesFetcher] No Enosys positions found. Exiting.');
    return;
  }

  // 2. Fetch rFLR rewards per position via API
  const positionRewards: Array<{ tokenId: string; rflr: number }> = [];

  for (const position of enosysPositions) {
    try {
      const rflrReward = await getRflrReward(position.tokenId);
      
      if (rflrReward && rflrReward > 0) {
        positionRewards.push({ tokenId: position.tokenId, rflr: rflrReward });
        console.log(`[APIIncentivesFetcher] Position ${position.tokenId}: ${rflrReward.toFixed(2)} rFLR`);
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 50));
    } catch (err) {
      console.warn(`[APIIncentivesFetcher] Failed to fetch rFLR for position ${position.tokenId}:`, err);
    }
  }

  console.log(`[APIIncentivesFetcher] Found ${positionRewards.length} positions with rFLR rewards`);

  if (positionRewards.length === 0) {
    console.log('[APIIncentivesFetcher] No rewards found. Exiting.');
    return;
  }

  // 3. Aggregate by pool (we need to resolve tokenId → pool first)
  // For now, create a single "Enosys V3 Global" incentive entry
  const totalRflr = positionRewards.reduce((sum, p) => sum + p.rflr, 0);
  const avgRflrPerPosition = totalRflr / positionRewards.length;

  // Estimate daily rate: 5% of current claimable amount accrues per day
  const DAILY_RATE_ESTIMATE = 0.05;
  const estimatedDailyRflr = avgRflrPerPosition * DAILY_RATE_ESTIMATE * positionRewards.length;
  const estimatedDailyUsd = estimatedDailyRflr * RFLR_PRICE_USD;

  console.log(
    `[APIIncentivesFetcher] Total: ${totalRflr.toFixed(2)} rFLR claimable across ${positionRewards.length} positions`
  );
  console.log(
    `[APIIncentivesFetcher] Estimated daily rate: ${estimatedDailyRflr.toFixed(2)} rFLR/day ($${estimatedDailyUsd.toFixed(2)})`
  );

  // 4. Since we don't have pool mapping yet, store as "global" Enosys incentive
  // This will be distributed across pools proportionally later
  console.log('[APIIncentivesFetcher] Note: Pool-specific mapping not yet available.');
  console.log('[APIIncentivesFetcher] Run pool enrichment script first, or use this as global Enosys rFLR rate.');

  console.log('[APIIncentivesFetcher] Done!');
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

