import { Address } from 'viem';

// Simple token price cache
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_DURATION = 60000; // 1 minute cache

export async function getTokenPrice(tokenAddress: Address): Promise<number> {
  const cacheKey = tokenAddress.toLowerCase();
  const cached = priceCache.get(cacheKey);
  
  // Return cached price if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price;
  }

  try {
    // Try to get price from CoinGecko API
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/token_price/flare-network?contract_addresses=${tokenAddress}&vs_currencies=usd`);
    const data = await response.json();
    
    if (data[tokenAddress.toLowerCase()]?.usd) {
      const price = data[tokenAddress.toLowerCase()].usd;
      priceCache.set(cacheKey, { price, timestamp: Date.now() });
      return price;
    }
  } catch (error) {
    console.warn(`Failed to fetch price for token ${tokenAddress}:`, error);
  }

  // Fallback: try to get price from DexScreener
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      const price = parseFloat(data.pairs[0].priceUsd);
      if (price > 0) {
        priceCache.set(cacheKey, { price, timestamp: Date.now() });
        return price;
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch DexScreener price for token ${tokenAddress}:`, error);
  }

  // Final fallback: return 1 for stablecoins, 0.1 for others
  const stablecoins = [
    '0x1d80c49BbBCd1C0911346656B529DF9E5c2F783d', // WFLR
    '0x1d80c49BbBCd1C0911346656B529DF9E5c2F783d', // USDT
  ];
  
  const fallbackPrice = stablecoins.includes(tokenAddress.toLowerCase()) ? 1 : 0.1;
  priceCache.set(cacheKey, { price: fallbackPrice, timestamp: Date.now() });
  return fallbackPrice;
}

export async function getTokenPrices(tokenAddresses: Address[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  
  // Fetch prices in parallel
  const pricePromises = tokenAddresses.map(async (address) => {
    const price = await getTokenPrice(address);
    prices.set(address.toLowerCase(), price);
  });
  
  await Promise.all(pricePromises);
  return prices;
}
