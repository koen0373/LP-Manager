import { positionsForWallet } from '@/lib/providers/blazeswapV2';
import type { BlazeSwapV2Position } from '@/lib/providers/blazeswapV2';
import type { PositionRow, TokenInfo } from '@/types/positions';
import { TOKEN_REGISTRY } from './tokenRegistry';
import { getTokenPriceByAddress } from './tokenPrices';

type Address = `0x${string}`;

const DEFAULT_FEE_TIER_BPS = 3000;

function normalize(address: string): Address {
  return address.toLowerCase() as Address;
}

function toTokenInfo(address: Address): TokenInfo | null {
  const entry = TOKEN_REGISTRY[address];
  if (!entry) {
    console.warn('[BlazeSwap] Token missing in registry', { address });
    return null;
  }

  return {
    symbol: entry.symbol,
    name: entry.name,
    decimals: entry.decimals,
    address,
  };
}

function bigIntFrom(value: string): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function formatAmount(raw: string, decimals: number): number {
  const amount = bigIntFrom(raw);
  if (amount === null) {
    return 0;
  }
  return Number(amount) / 10 ** decimals;
}

async function enrichPosition(
  wallet: Address,
  position: BlazeSwapV2Position,
  token0: TokenInfo,
  token1: TokenInfo,
  priceCache: Map<Address, number>,
): Promise<PositionRow> {
  const balance = bigIntFrom(position.balance) ?? 0n;
  const totalSupply = bigIntFrom(position.totalSupply) ?? 0n;

  const amount0 = formatAmount(position.amount0, token0.decimals);
  const amount1 = formatAmount(position.amount1, token1.decimals);

  async function getPrice(address: Address): Promise<number> {
    if (priceCache.has(address)) {
      return priceCache.get(address)!;
    }
    const price = await getTokenPriceByAddress(address);
    priceCache.set(address, price);
    return price;
  }

  const [price0, price1] = await Promise.all([
    getPrice(token0.address as Address),
    getPrice(token1.address as Address),
  ]);

  const tvlUsd = amount0 * price0 + amount1 * price1;
  const sharePct = Number.isFinite(position.sharePct) ? position.sharePct : 0;

  return {
    id: `BLAZE-${position.pair.slice(2, 8)}`,
    displayId: `BLAZE-${position.pair.slice(2, 8)}`,
    provider: 'BlazeSwap V2',
    providerSlug: 'blazeswap-v2',
    dexName: 'BlazeSwap',
    onchainId: position.pair,
    pairLabel: `${token0.symbol} / ${token1.symbol}`,
    feeTierBps: DEFAULT_FEE_TIER_BPS,
    tickLowerLabel: '—',
    tickUpperLabel: '—',
    tvlUsd,
    unclaimedFeesUsd: 0,
    fee0: 0,
    fee1: 0,
    incentivesUsd: 0,
    rflrRewardsUsd: 0,
    rflrAmount: 0,
    rflrUsd: 0,
    rflrPriceUsd: 0,
    rewardsUsd: 0,
    category: tvlUsd > 0 ? 'Active' : 'Inactive',
    status: 'Active',
    inRange: true,
    isInRange: true,
    token0,
    token1,
    amount0,
    amount1,
    lowerPrice: Number.NaN,
    upperPrice: Number.NaN,
    tickLower: 0,
    tickUpper: 0,
    poolAddress: position.pair,
    price0Usd: price0,
    price1Usd: price1,
    walletAddress: wallet,
    currentTick: 0,
    createdAt: undefined,
    lastUpdated: new Date().toISOString(),
    liquidity: balance,
    poolLiquidity: totalSupply,
    poolSharePct: sharePct,
  };
}

export async function getBlazeSwapPositions(wallet: Address): Promise<PositionRow[]> {
  const { positions } = await positionsForWallet(wallet);
  if (positions.length === 0) {
    return [];
  }

  const priceCache = new Map<Address, number>();
  const enriched: PositionRow[] = [];

  for (const position of positions) {
    const token0 = toTokenInfo(normalize(position.token0.address));
    const token1 = toTokenInfo(normalize(position.token1.address));

    if (!token0 || !token1) {
      continue;
    }

    try {
      const converted = await enrichPosition(wallet, position, token0, token1, priceCache);
      enriched.push(converted);
    } catch (error) {
      console.error('[BlazeSwap] Failed to enrich position', {
        pair: position.pair,
        error,
      });
    }
  }

  return enriched;
}
