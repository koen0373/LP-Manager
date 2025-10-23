import { getClaimableAps, clearApsRewardCache } from '../lib/data/apsRewards';

export async function getApsRewardForPosition(positionId: string): Promise<{ amount: number; priceUsd: number } | null> {
  return await getClaimableAps(positionId);
}

export { clearApsRewardCache };
