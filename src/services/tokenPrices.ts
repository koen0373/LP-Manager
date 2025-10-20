// Simple token price service with hardcoded prices for known tokens
// This can be replaced with a real API later

const TOKEN_PRICES: Record<string, number> = {
  // Flare tokens
  'WFLR': 0.01758, // Wrapped Flare
  'FLR': 0.01758,  // Flare
  'SFLR': 0.01758, // Songbird Flare
  
  // Stablecoins
  'USDT0': 1.0,    // USD₮0
  'USDTO': 1.0,    // USD₮0 (alternative symbol)
  'USDT': 1.0,     // Tether
  'USDC': 1.0,     // USD Coin
  'DAI': 1.0,      // Dai
  
  // Other tokens
  'FXRP': 0.52,    // Flare XRP
  'EETH': 3500.0,  // Ethereum
  'EQNT': 0.15,    // Equilibria
  'EUSDT': 1.0,    // Ethereum USDT
  'HLN': 0.25,     // Holon
  'APS': 0.05,     // Apollo
  'USDX': 1.0,     // USDX
  'XRP': 0.52,     // XRP
  'BTC': 65000.0,  // Bitcoin
  'ETH': 3500.0,   // Ethereum
};

// Cache for API prices
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export async function getTokenPrice(symbol: string): Promise<number> {
  const normalizedSymbol = symbol.toUpperCase();
  
  // Check cache first
  const cached = priceCache.get(normalizedSymbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }
  
  // Check hardcoded prices
  if (TOKEN_PRICES[normalizedSymbol]) {
    const price = TOKEN_PRICES[normalizedSymbol];
    priceCache.set(normalizedSymbol, { price, timestamp: Date.now() });
    return price;
  }
  
  // Try to fetch from CoinGecko (optional)
  try {
    const price = await fetchFromCoinGecko(normalizedSymbol);
    if (price > 0) {
      priceCache.set(normalizedSymbol, { price, timestamp: Date.now() });
      return price;
    }
  } catch (error) {
    console.warn(`Failed to fetch price for ${normalizedSymbol}:`, error);
  }
  
  // Fallback to 0
  return 0;
}

async function fetchFromCoinGecko(symbol: string): Promise<number> {
  // Map symbols to CoinGecko IDs
  const coinGeckoMap: Record<string, string> = {
    'WFLR': 'flare',
    'FLR': 'flare',
    'SFLR': 'songbird',
    'FXRP': 'flare-xrp',
    'XRP': 'ripple',
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'DAI': 'dai',
  };
  
  const coinId = coinGeckoMap[symbol];
  if (!coinId) return 0;
  
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
    { 
      headers: { 'Accept': 'application/json' },
      // Add timeout
      signal: AbortSignal.timeout(5000)
    }
  );
  
  if (!response.ok) return 0;
  
  const data = await response.json();
  return data[coinId]?.usd || 0;
}

export async function getTokenPrices(symbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  
  // Fetch all prices in parallel
  const pricePromises = symbols.map(async (symbol) => {
    const price = await getTokenPrice(symbol);
    return { symbol: symbol.toUpperCase(), price };
  });
  
  const results = await Promise.all(pricePromises);
  
  for (const { symbol, price } of results) {
    prices[symbol] = price;
  }
  
  return prices;
}

// Helper to calculate USD value
export function calculateUsdValue(amount: bigint, decimals: number, price: number): number {
  const divisor = BigInt(10 ** decimals);
  const amountFloat = Number(amount) / Number(divisor);
  return amountFloat * price;
}
