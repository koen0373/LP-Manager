import type { Address } from 'viem';

type IconCacheEntry = {
  url: string | null;
  timestamp: number;
};

const cache = new Map<Address, IconCacheEntry>();
const symbolCache = new Map<string, string | null>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Well-known token addresses on Flare
const KNOWN_TOKENS: Record<string, Address> = {
  'WFLR': '0x1d80c49bbbcd1c0911346656b529df9e5c2f783d',
  'FLR': '0x1d80c49bbbcd1c0911346656b529df9e5c2f783d',
  'USDT0': '0xe7cd86e13ac4309349f30b3435a9d337750fc82d',
  'USD0': '0xe7cd86e13ac4309349f30b3435a9d337750fc82d',
  'EUSDT': '0x96b41289d90444b8add57e6f265db5ae8651df29',
  'SGB': '0x02f0826ef6ad107cfc861152b32b52fd11bab9ed',
  'EXFI': '0xc348f894c0b6cf348b79328a6e131e0300d428c7',
  'CAND': '0x70ad7172ef0b131a1428d0c1f66457eb041f2176',
  'FXRP': '0xad552a648c74d49e10027ab8a618a3ad4901c5be',
  'APS': '0xff56eb5b1a7faa972291117e5e9565da29bc808d',
};

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

export async function fetchTokenIconBySymbol(symbol: string): Promise<string | null> {
  const normalized = symbol.toUpperCase().replace('₮', '').replace('₀', '0');
  
  // Check symbol cache
  const cached = symbolCache.get(normalized);
  if (cached !== undefined) {
    return cached;
  }

  // Look up address
  const address = KNOWN_TOKENS[normalized];
  if (!address) {
    symbolCache.set(normalized, null);
    return null;
  }

  // Fetch icon by address
  const icon = await fetchTokenIcon(address);
  symbolCache.set(normalized, icon);
  return icon;
}

export function clearTokenIconCache(): void {
  cache.clear();
  symbolCache.clear();
}
