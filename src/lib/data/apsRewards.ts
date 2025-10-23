// src/lib/data/apsRewards.ts
// Temporarily disabled APS rewards fetching to improve performance
// This file contains the infrastructure but is not currently active

export async function getApsRewardForPosition(_tokenId: string): Promise<{ amount: number; priceUsd: number } | null> {
  // Temporarily disabled to improve performance
  void _tokenId;
  return null;
}

export async function getClaimableAps(_tokenId: string): Promise<{ amount: number; priceUsd: number } | null> {
  // Temporarily disabled to improve performance
  void _tokenId;
  return null;
}

export function clearApsRewardCache(): void {
  // Temporarily disabled to improve performance
  console.log('[APS] Cache clear requested but APS rewards are disabled');
}
