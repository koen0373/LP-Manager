/**
 * Incentives Aggregator
 * 
 * Analyseert StakingEvent data en berekent rewards per pool per dag.
 * Update PoolIncentive tabel met computed values.
 * 
 * Usage:
 *   npx tsx scripts/compute-incentives.mts
 */

import { PrismaClient } from '@prisma/client';
import { createPublicClient, http } from 'viem';
import { flare } from 'viem/chains';

const prisma = new PrismaClient();

const FLARE_RPC = process.env.FLARE_RPC_URL || 'https://flare-api.flare.network/ext/bc/C/rpc';

interface PoolRewards {
  poolAddress: string;
  dex: string;
  rewardToken: string;
  rewardPerDay: number;
  samplePeriodDays: number;
}

async function main() {
  console.log('[IncentivesAggregator] Starting...');

  // 1. Aggregate reward events from last 7 days
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  const rewardEvents = await prisma.stakingEvent.findMany({
    where: {
      eventName: { in: ['RewardPaid', 'Harvest', 'RewardAdded'] },
      timestamp: { gte: sevenDaysAgo },
      poolAddress: { not: null },
    },
    select: {
      poolAddress: true,
      stakingContract: true,
      rewardToken: true,
      amount: true,
      timestamp: true,
      metadata: true,
    },
  });

  console.log(`[IncentivesAggregator] Found ${rewardEvents.length} reward events`);

  if (rewardEvents.length === 0) {
    console.log('[IncentivesAggregator] No reward events found. Exiting.');
    return;
  }

  // 2. Group by pool + reward token
  const poolRewardsMap = new Map<string, PoolRewards>();

  for (const event of rewardEvents) {
    if (!event.poolAddress || !event.rewardToken || !event.amount) continue;

    const key = `${event.poolAddress}:${event.rewardToken}`;
    
    if (!poolRewardsMap.has(key)) {
      poolRewardsMap.set(key, {
        poolAddress: event.poolAddress,
        dex: (event.metadata as any)?.dex || 'unknown',
        rewardToken: event.rewardToken,
        rewardPerDay: 0,
        samplePeriodDays: 7,
      });
    }

    const poolRewards = poolRewardsMap.get(key)!;
    poolRewards.rewardPerDay += Number(event.amount);
  }

  // 3. Convert total rewards → per day average
  const poolRewardsList: PoolRewards[] = [];
  for (const [, rewards] of poolRewardsMap) {
    rewards.rewardPerDay = rewards.rewardPerDay / rewards.samplePeriodDays;
    poolRewardsList.push(rewards);
  }

  console.log(`[IncentivesAggregator] Computed rewards for ${poolRewardsList.length} pools`);

  // 4. Fetch token prices
  const uniqueTokens = [...new Set(poolRewardsList.map((r) => r.rewardToken))];
  const prices = await fetchTokenPrices(uniqueTokens);

  // 5. Upsert into PoolIncentive table
  for (const rewards of poolRewardsList) {
    const priceUsd = prices.get(rewards.rewardToken) || 0;
    const rewardUsdPerDay = rewards.rewardPerDay * priceUsd;

    // Fetch token symbol
    const tokenSymbol = await getTokenSymbol(rewards.rewardToken);

    await prisma.poolIncentive.upsert({
      where: {
        poolAddress_rewardToken_startDate: {
          poolAddress: rewards.poolAddress,
          rewardToken: rewards.rewardToken,
          startDate: new Date(sevenDaysAgo * 1000),
        },
      },
      create: {
        poolAddress: rewards.poolAddress,
        dex: rewards.dex,
        rewardToken: rewards.rewardToken,
        rewardTokenSymbol: tokenSymbol,
        rewardPerDay: rewards.rewardPerDay.toString(),
        rewardUsdPerDay: rewardUsdPerDay.toString(),
        startDate: new Date(sevenDaysAgo * 1000),
        sourceType: 'on-chain',
        isActive: true,
        verified: false, // Auto-computed, needs manual verification
      },
      update: {
        rewardPerDay: rewards.rewardPerDay.toString(),
        rewardUsdPerDay: rewardUsdPerDay.toString(),
        updatedAt: new Date(),
      },
    });

    console.log(
      `[IncentivesAggregator] ✓ ${rewards.poolAddress} (${rewards.dex}): ${rewards.rewardPerDay.toFixed(2)} ${tokenSymbol}/day ($${rewardUsdPerDay.toFixed(2)})`
    );
  }

  console.log('[IncentivesAggregator] Done!');
}

/**
 * Fetch token prices via Ankr or DefiLlama
 */
async function fetchTokenPrices(tokens: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();

  // TODO: Implement via Ankr ankr_getTokenPrice or DefiLlama API
  // For now, return mock prices
  console.log(`[IncentivesAggregator] Fetching prices for ${tokens.length} tokens...`);
  
  for (const token of tokens) {
    prices.set(token, 0.5); // Mock: $0.50 per token
  }

  return prices;
}

/**
 * Get token symbol via on-chain read
 */
async function getTokenSymbol(tokenAddress: string): Promise<string> {
  try {
    const client = createPublicClient({
      chain: flare,
      transport: http(FLARE_RPC),
    });

    const symbol = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: [
        {
          type: 'function',
          name: 'symbol',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'string' }],
        },
      ],
      functionName: 'symbol',
    });

    return symbol as string;
  } catch (err) {
    console.warn(`[IncentivesAggregator] Failed to fetch symbol for ${tokenAddress}:`, err);
    return '???';
  }
}

main()
  .catch((err) => {
    console.error('[IncentivesAggregator] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });

