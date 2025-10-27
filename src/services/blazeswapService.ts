import { publicClient } from '@/lib/viemClient';
import { getTokenPriceByAddress } from './tokenPrices';
import type { PositionRow, TokenInfo } from '@/types/positions';
import { TOKEN_REGISTRY } from './tokenRegistry';

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

const PAIR_ABI = [
  {
    name: 'getReserves',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: '_reserve0', type: 'uint112' },
      { name: '_reserve1', type: 'uint112' },
      { name: '_blockTimestampLast', type: 'uint32' },
    ],
  },
  {
    name: 'token0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'token1',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
];

const BLAZESWAP_PAIRS = [
  {
    address: '0x3D6EFEe2e110F13ea22231be6B01B428B38Cafc92' as const,
    feeTierBps: 3000,
  },
  {
    address: '0x5eD30e42757E3edd2f8898FbcA26cd7c6f391Ae1' as const,
    feeTierBps: 3000,
  },
];

function normalizeAddress(address: string): `0x${string}` {
  return address.toLowerCase() as `0x${string}`;
}

function toTokenInfo(address: `0x${string}`): TokenInfo | null {
  const entry = TOKEN_REGISTRY[address];
  if (!entry) {
    console.warn(`[BLAZESWAP] Token not found in registry: ${address}`);
    return null;
  }
  return {
    symbol: entry.symbol,
    name: entry.name,
    decimals: entry.decimals,
    address,
  };
}

export async function getBlazeSwapPositions(wallet: `0x${string}`): Promise<PositionRow[]> {
  const positions: PositionRow[] = [];

  for (const pair of BLAZESWAP_PAIRS) {
    try {
      const balance = (await publicClient.readContract({
        address: pair.address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [wallet],
      })) as bigint;

      if (balance === 0n) {
        continue;
      }

      const [totalSupply, token0Addr, token1Addr] = await Promise.all([
        publicClient.readContract({
          address: pair.address,
          abi: ERC20_ABI,
          functionName: 'totalSupply',
          args: [],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: pair.address,
          abi: PAIR_ABI,
          functionName: 'token0',
          args: [],
        }) as Promise<`0x${string}`>,
        publicClient.readContract({
          address: pair.address,
          abi: PAIR_ABI,
          functionName: 'token1',
          args: [],
        }) as Promise<`0x${string}`>,
      ]);

      const reserves = (await publicClient.readContract({
        address: pair.address,
        abi: PAIR_ABI,
        functionName: 'getReserves',
        args: [],
      })) as [bigint, bigint, number];

      const token0Info = toTokenInfo(normalizeAddress(token0Addr));
      const token1Info = toTokenInfo(normalizeAddress(token1Addr));

      if (!token0Info || !token1Info) {
        continue;
      }

      const share = Number(balance) / Number(totalSupply);

      const reserve0 = Number(reserves[0]) / 10 ** token0Info.decimals;
      const reserve1 = Number(reserves[1]) / 10 ** token1Info.decimals;

      const amount0 = reserve0 * share;
      const amount1 = reserve1 * share;

      const [price0, price1] = await Promise.all([
        getTokenPriceByAddress(token0Info.address as `0x${string}`),
        getTokenPriceByAddress(token1Info.address as `0x${string}`),
      ]);

      const tvlUsd = amount0 * price0 + amount1 * price1;

      const pairLabel = `${token0Info.symbol} / ${token1Info.symbol}`;

      positions.push({
        id: `BLAZE-${pair.address.slice(2, 8)}`,
        displayId: `BLAZE-${pair.address.slice(2, 8)}`,
        provider: 'BlazeSwap v2',
        providerSlug: 'blazeswap-v2',
        onchainId: pair.address,
        pairLabel,
        feeTierBps: pair.feeTierBps,
        tickLowerLabel: '—',
        tickUpperLabel: '—',
        tvlUsd,
        rewardsUsd: 0,
        unclaimedFeesUsd: 0,
        rflrRewardsUsd: 0,
        rflrAmount: 0,
        rflrUsd: 0,
        rflrPriceUsd: 0,
        inRange: true,
        status: 'Active',
        token0: token0Info,
        token1: token1Info,
        amount0,
        amount1,
        lowerPrice: Number.NaN,
        upperPrice: Number.NaN,
        tickLower: 0,
        tickUpper: 0,
        isInRange: true,
        poolAddress: pair.address,
        price0Usd: price0,
        price1Usd: price1,
        fee0: 0,
        fee1: 0,
        walletAddress: wallet,
        currentTick: 0,
        createdAt: undefined,
        lastUpdated: new Date().toISOString(),
        liquidity: balance,
        poolLiquidity: totalSupply,
        poolSharePct: share * 100,
      });
    } catch (error) {
      console.error(`[BLAZESWAP] Failed to process pair ${pair.address}:`, error);
      continue;
    }
  }

  return positions;
}
