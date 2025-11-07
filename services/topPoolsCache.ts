export async function getTopPools(limit: number = 10) {
  return [
    { id: 'stub-1', name: 'WFLR/USDC.e', tvlUsd: 120000 },
    { id: 'stub-2', name: 'FXRP/WFLR', tvlUsd: 95000 },
  ].slice(0, limit);
}

export async function refreshTopPools() {
  return;
}

export function clearCache() {
  return;
}
