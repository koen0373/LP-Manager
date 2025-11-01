import { Contract, providers } from 'ethers';

import RouterABI from '../abi/blazeswap/IBlazeSwapRouter.json';
import FactoryABI from '../abi/uniswapV2Factory.json';
import PairABI from '../abi/uniswapV2Pair.json';
import { ERC20_ABI } from '@/lib/onchain/abis';
import { getFlareRpcUrl, makeProvider } from '../chains/flare';
import { BLAZESWAP_ROUTER_ADDRESS } from './client';

export type PairSnapshot = {
  address: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  blockTimestampLast: number;
  lpSymbol: string;
  lpName: string;
  lpDecimals: number;
};

export type TokenMetadata = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
};

export type UserLpPosition = {
  lpBalance: string;
  lpTotalSupply: string;
  shareBps: number;
  amount0: string;
  amount1: string;
};

export function getProvider(): providers.JsonRpcProvider {
  return makeProvider();
}

export async function getFactoryAddress(
  provider: providers.JsonRpcProvider,
): Promise<string> {
  const router = new Contract(
    BLAZESWAP_ROUTER_ADDRESS,
    RouterABI,
    provider,
  );
  const factoryAddress: string = await router.factory();
  return factoryAddress;
}

export async function paginatePairs(
  provider: providers.JsonRpcProvider,
  {
    start = 0,
    limit = 100,
  }: { start?: number; limit?: number } = {},
): Promise<{
  pairs: string[];
  totalPairs: number;
  nextStart: number | null;
  factory: string;
}> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const safeStart = Math.max(0, start);

  const factoryAddress = await getFactoryAddress(provider);
  const factory = new Contract(factoryAddress, FactoryABI, provider);
  const totalPairsBig: bigint = await factory.allPairsLength();
  const totalPairs = Number(totalPairsBig);

  const endIndex = Math.min(totalPairs, safeStart + safeLimit);
  const pairs: string[] = [];

  for (let i = safeStart; i < endIndex; i += 1) {
    const pairAddress: string = await factory.allPairs(i);
    pairs.push(pairAddress);
  }

  return {
    pairs,
    totalPairs,
    factory: factoryAddress,
    nextStart: endIndex < totalPairs ? endIndex : null,
  };
}

export async function readPairSnapshot(
  provider: providers.JsonRpcProvider,
  pairAddress: string,
): Promise<PairSnapshot> {
  const pair = new Contract(pairAddress, PairABI, provider);
  const [token0, token1, reserves, totalSupply, symbol, name, decimals] =
    await Promise.all([
      pair.token0(),
      pair.token1(),
      pair.getReserves(),
      pair.totalSupply(),
      pair.symbol(),
      pair.name(),
      pair.decimals(),
    ]);

  return {
    address: pairAddress,
    token0,
    token1,
    reserve0: reserves[0].toString(),
    reserve1: reserves[1].toString(),
    totalSupply: totalSupply.toString(),
    blockTimestampLast: Number(reserves[2]),
    lpSymbol: symbol,
    lpName: name,
    lpDecimals: Number(decimals),
  };
}

export async function readUserLpPosition(
  provider: providers.JsonRpcProvider,
  user: string,
  pairAddress: string,
): Promise<UserLpPosition> {
  const pair = new Contract(pairAddress, PairABI, provider);
  const [[reserve0, reserve1], totalSupply, lpBalance] = await Promise.all([
    pair.getReserves(),
    pair.totalSupply(),
    pair.balanceOf(user),
  ]);

  const totalSupplyBig = BigInt(totalSupply);
  const lpBalanceBig = BigInt(lpBalance);

  if (totalSupplyBig === 0n) {
    return {
      lpBalance: '0',
      lpTotalSupply: '0',
      shareBps: 0,
      amount0: '0',
      amount1: '0',
    };
  }

  const share = (lpBalanceBig * 10_000n) / totalSupplyBig;
  const amount0 = (BigInt(reserve0) * lpBalanceBig) / totalSupplyBig;
  const amount1 = (BigInt(reserve1) * lpBalanceBig) / totalSupplyBig;

  return {
    lpBalance: lpBalanceBig.toString(),
    lpTotalSupply: totalSupplyBig.toString(),
    shareBps: Number(share),
    amount0: amount0.toString(),
    amount1: amount1.toString(),
  };
}

export async function fetchTokenMeta(
  provider: providers.JsonRpcProvider,
  token: string,
): Promise<TokenMetadata> {
  const contract = new Contract(token, ERC20_ABI, provider);
  const [symbol, name, decimals] = await Promise.all([
    contract.symbol(),
    contract.name(),
    contract.decimals(),
  ]);

  return {
    address: token,
    symbol,
    name,
    decimals: Number(decimals),
  };
}

export function isBlazeSwapEnabled(): boolean {
  const flag =
    process.env.ENABLE_BLAZESWAP ??
    process.env.NEXT_PUBLIC_ENABLE_BLAZESWAP ??
    '';
  return flag.toLowerCase() === 'true';
}

export function ensureRpcConfigured(): void {
  const rpc = getFlareRpcUrl();
  if (!rpc) {
    throw new Error('FLARE_RPC_URL not configured');
  }
}
