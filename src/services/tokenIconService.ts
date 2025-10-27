import type { Address } from 'viem';

type IconCacheEntry = {
  url: string | null;
  timestamp: number;
};

const cache = new Map<Address, IconCacheEntry>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function fetchTokenIcon(address: Address): Promise<string | null> {
  const cached = cache.get(address);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.url;
  }

  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    if (!response.ok) {
      throw new Error(`DexScreener responded with ${response.status}`);
    }

    const data = await response.json();
    const icon = data?.pairs?.[0]?.info?.imageUrl ?? null;

    cache.set(address, { url: icon, timestamp: Date.now() });
    return icon;
  } catch (error) {
    console.warn(`[tokenIconService] Failed to fetch icon for ${address}:`, error);
    cache.set(address, { url: null, timestamp: Date.now() });
    return null;
  }
}

export function clearTokenIconCache(): void {
  cache.clear();
}
