// Token registry with address-based pricing and deterministic resolution order
type Address = `0x${string}`;

type PriceSource =
  | { kind: 'hard'; usd: number }
  | { kind: 'onchainPool'; pool: Address; base: Address; quote: Address }
  | { kind: 'coingecko'; platform: 'flare'; address: Address };

export type TokenConfig = {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  price: PriceSource[];
};

// Token registry by address (deterministic order)
export const TOKEN_REGISTRY: Record<Address, TokenConfig> = {
  // RFLR - hardcoded price
  '0x1d80c49bbbcd1c0911346656b529df9e5c2f783d': {
    address: '0x1d80c49bbbcd1c0911346656b529df9e5c2f783d',
    symbol: 'WFLR',
    name: 'Wrapped Flare',
    decimals: 18,
    price: [{ kind: 'hard', usd: 0.01758 }]
  },
  
  // RFLR rewards token - hardcoded price
  '0x0000000000000000000000000000000000000000': { // Placeholder for RFLR rewards
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'RFLR',
    name: 'Reward Flare',
    decimals: 18,
    price: [{ kind: 'hard', usd: 0.01758 }]
  },
  
  // eUSDT - hardcoded stable price
  '0x96b41289d90444b8add57e6f265db5ae8651df29': {
    address: '0x96b41289d90444b8add57e6f265db5ae8651df29',
    symbol: 'eUSDT',
    name: 'Enosys USDT',
    decimals: 6,
    price: [{ kind: 'hard', usd: 1.0 }]
  },
  
  // USD₮0 - hardcoded stable price
  '0xe7cd86e13ac4309349f30b3435a9d337750fc82d': {
    address: '0xe7cd86e13ac4309349f30b3435a9d337750fc82d',
    symbol: 'USD₮0',
    name: 'USD₮0',
    decimals: 6,
    price: [{ kind: 'hard', usd: 1.0 }]
  },
  
  // FXRP - on-chain pricing via FXRP/USD₮0 pool
  '0xad552a648c74d49e10027ab8a618a3ad4901c5be': {
    address: '0xad552a648c74d49e10027ab8a618a3ad4901c5be',
    symbol: 'FXRP',
    name: 'FXRP',
    decimals: 6,
    price: [
      { 
        kind: 'onchainPool', 
        pool: '0x686f53f0950ef193c887527ec027e6a574a4dbe1', // FXRP/USD₮0 pool
        base: '0xad552a648c74d49e10027ab8a618a3ad4901c5be', // FXRP
        quote: '0xe7cd86e13ac4309349f30b3435a9d337750fc82d'  // USD₮0
      }
    ]
  },
  
  // APS - on-chain pricing via eUSDT/APS pool
  '0xff56eb5b1a7faa972291117e5e9565da29bc808d': {
    address: '0xff56eb5b1a7faa972291117e5e9565da29bc808d',
    symbol: 'APS',
    name: 'Apsis',
    decimals: 18,
    price: [
      { 
        kind: 'onchainPool', 
        pool: '0xcf93d54e7fea895375667fa071d5b48c81e76d7d', // eUSDT/APS pool
        base: '0x96b41289d90444b8add57e6f265db5ae8651df29', // eUSDT
        quote: '0xff56eb5b1a7faa972291117e5e9565da29bc808d'  // APS
      }
    ]
  }
};

// Price cache to ensure consistency within a single calculation
const priceCache = new Map<Address, { price: number; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export async function getUsdPriceNow(tokenAddress: Address): Promise<number> {
  // Check cache first
  const normalizedAddress = tokenAddress.toLowerCase() as Address;
  const cached = priceCache.get(normalizedAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }
  
  const token = TOKEN_REGISTRY[normalizedAddress];
  if (!token) {
    throw new Error(`Token not found in registry: ${tokenAddress}`);
  }
  
  for (const source of token.price) {
    try {
      let price: number;
      
      if (source.kind === 'hard') {
        price = source.usd;
      } else if (source.kind === 'onchainPool') {
        price = await getOnChainPrice(source.pool, source.base, source.quote);
      } else if (source.kind === 'coingecko') {
        price = await getCoinGeckoPrice(source.platform, source.address);
      } else {
        continue;
      }
      
      // Cache the result
      priceCache.set(normalizedAddress, { price, timestamp: Date.now() });
      console.log(`[PRICE-REGISTRY] ${token.symbol}: $${price} (source: ${source.kind})`);
      return price;
      
    } catch (error) {
      console.warn(`[PRICE-REGISTRY] Failed to get price for ${token.symbol} via ${source.kind}:`, error);
      continue;
    }
  }
  
  throw new Error(`No price source resolved for ${token.symbol} (${tokenAddress})`);
}

async function getOnChainPrice(poolAddress: Address, baseToken: Address, quoteToken: Address): Promise<number> {
  // Import viem client
  const { createPublicClient, http } = await import('viem');
  const { flare } = await import('viem/chains');
  
  const client = createPublicClient({
    chain: flare,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL ?? 'https://flare.flr.finance/ext/bc/C/rpc')
  });
  
  // Get slot0 from the pool
  const slot0 = await client.readContract({
    address: poolAddress,
    abi: [
      {
        inputs: [],
        name: 'slot0',
        outputs: [
          { name: 'sqrtPriceX96', type: 'uint160' },
          { name: 'tick', type: 'int24' },
          { name: 'observationIndex', type: 'uint16' },
          { name: 'observationCardinality', type: 'uint16' },
          { name: 'observationCardinalityNext', type: 'uint16' },
          { name: 'feeProtocol', type: 'uint8' },
          { name: 'unlocked', type: 'bool' }
        ],
        stateMutability: 'view',
        type: 'function'
      }
    ],
    functionName: 'slot0'
  });
  
  // Get token decimals
  const baseDecimals = TOKEN_REGISTRY[baseToken]?.decimals || 18;
  const quoteDecimals = TOKEN_REGISTRY[quoteToken]?.decimals || 18;
  
  // Calculate price: sqrtPriceX96^2 * 10^(decimals0 - decimals1)
  const sqrtPriceX96 = slot0[0];
  const price = Number(sqrtPriceX96) ** 2 / (2 ** 192) * (10 ** (baseDecimals - quoteDecimals));
  
  // If quote token is USD stablecoin, return price directly
  if (quoteToken === '0xe7cd86e13ac4309349f30b3435a9d337750fc82d' || 
      quoteToken === '0x96b41289d90444b8add57e6f265db5ae8651df29') {
    return price;
  }
  
  // Otherwise, convert via quote token's USD price
  const quotePriceUsd = await getUsdPriceNow(quoteToken);
  return price * quotePriceUsd;
}

async function getCoinGeckoPrice(platform: string, address: Address): Promise<number> {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${platform}/contract/${address}`
  );
  
  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.market_data?.current_price?.usd || 0;
}

// Clear cache function for testing
export function clearPriceCache(): void {
  priceCache.clear();
}
