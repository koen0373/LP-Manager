const RFLR_REWARD_BASE_URL = 'https://v3.dex.enosys.global/api/flr/v2/stats/rflr';
const CACHE_TTL_MS = 30_000;

type CacheEntry = {
  value: number;
  expires: number;
};

const rewardCache = new Map<string, CacheEntry>();

function getCachedReward(positionId: string): number | null {
  const cached = rewardCache.get(positionId);
  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expires) {
    rewardCache.delete(positionId);
    return null;
  }

  return cached.value;
}

function setCachedReward(positionId: string, value: number) {
  rewardCache.set(positionId, {
    value,
    expires: Date.now() + CACHE_TTL_MS,
  });

  if (rewardCache.size > 200) {
    const firstKey = rewardCache.keys().next().value;
    if (firstKey) {
      rewardCache.delete(firstKey);
    }
  }
}

export async function getRflrRewardForPosition(positionId: string): Promise<number | null> {
  if (!positionId) {
    return null;
  }

  const cached = getCachedReward(positionId);
  if (cached !== null) {
    return cached;
  }

  try {
    const response = await fetch(`${RFLR_REWARD_BASE_URL}/${positionId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[RFLR] Failed to fetch reward for position ${positionId}: ${response.status}`);
      return null;
    }

    const reward = await response.json();
    const numericReward = typeof reward === 'number' ? reward : Number(reward);

    if (Number.isFinite(numericReward)) {
      setCachedReward(positionId, numericReward);
      return numericReward;
    }

    console.warn(`[RFLR] Reward for position ${positionId} is not numeric`, reward);
    return null;
  } catch (error) {
    console.error(`[RFLR] Error fetching reward for position ${positionId}:`, error);
    return null;
  }
}

export function clearRflrRewardCache(): void {
  rewardCache.clear();
}
