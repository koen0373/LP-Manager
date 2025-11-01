import type { Address } from 'viem';
import { getAddress } from 'viem';

import { blazeSwapFactoryV2Abi } from '@/lib/blazeswap/abi/factoryV2';
import { blazeSwapPairV2Abi } from '@/lib/blazeswap/abi/pairV2';
import {
  flare,
  getFlareClient,
  type FlareClient,
} from '@/chains/flare';

const ENUMERATION_BATCH = 200;
const BALANCE_BATCH = 100;
const DETAIL_BATCH = 20;
const CACHE_TTL_MS = 5 * 60 * 1000;
const BIGINT_MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

export type BlazeSwapV2Position = {
  provider: 'blazeswap-v2';
  type: 'v2';
  pair: `0x${string}`;
  token0: { address: `0x${string}` };
  token1: { address: `0x${string}` };
  balance: string;
  totalSupply: string;
  reserves: { r0: string; r1: string };
  sharePct: number;
  amount0: string;
  amount1: string;
  status: 'active';
};

export type BlazeSwapV2Meta = {
  scanned: number;
  totalPairs: number;
};

type CachedPairs = {
  factory: `0x${string}`;
  totalPairs: number;
  pairs: (`0x${string}` | null)[];
  expiresAt: number;
};

type BalanceEntry = {
  address: `0x${string}`;
  balance: bigint;
};

let cachedPairs: CachedPairs | null = null;

function getFactoryAddress(): `0x${string}` | null {
  const raw = process.env.BLAZESWAP_FACTORY ?? '';
  if (!raw || raw.trim().length === 0) {
    return null;
  }

  try {
    return getAddress(raw.trim());
  } catch (error) {
    console.warn('[blazeswap-v2] Invalid BLAZESWAP_FACTORY value', {
      raw,
      error,
    });
    return null;
  }
}

function toNumber(value: bigint): number {
  if (value > BIGINT_MAX_SAFE) {
    return Number.MAX_SAFE_INTEGER;
  }
  if (value < 0) {
    return 0;
  }
  return Number(value);
}

function toBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === 'string' && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

function toChecksum(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null;
  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

async function executeMulticall(
  client: FlareClient,
  contracts: readonly {
    address: Address;
    abi: typeof blazeSwapFactoryV2Abi | typeof blazeSwapPairV2Abi;
    functionName: string;
    args?: readonly unknown[];
  }[],
): Promise<unknown[]> {
  try {
    const response = await client.multicall({
      allowFailure: true,
      contracts: contracts as any,
    });

    return response.map((entry) =>
      entry.status === 'success' ? entry.result : null,
    );
  } catch (multicallError) {
    console.warn('[blazeswap-v2] Multicall unavailable, falling back to serial reads.', {
      error: multicallError instanceof Error ? multicallError.message : multicallError,
    });

    const settled = await Promise.allSettled(
      contracts.map((config) => client.readContract(config as any)),
    );

    return settled.map((entry) =>
      entry.status === 'fulfilled' ? entry.value : null,
    );
  }
}

async function refreshCache(
  client: FlareClient,
  factory: `0x${string}`,
): Promise<void> {
  const totalPairsRaw = await client.readContract({
    address: factory,
    abi: blazeSwapFactoryV2Abi,
    functionName: 'allPairsLength',
  });

  const totalPairs = toNumber(totalPairsRaw as bigint);
  cachedPairs = {
    factory,
    totalPairs,
    pairs: [],
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
}

async function ensurePairAddresses(
  client: FlareClient,
  factory: `0x${string}`,
  maxPairs?: number,
): Promise<{ pairs: `0x${string}`[]; totalPairs: number }> {
  const now = Date.now();

  if (
    !cachedPairs ||
    cachedPairs.factory !== factory ||
    cachedPairs.expiresAt < now
  ) {
    await refreshCache(client, factory);
  }

  if (!cachedPairs) {
    return { pairs: [], totalPairs: 0 };
  }

  const target = maxPairs
    ? Math.min(cachedPairs.totalPairs, Math.max(maxPairs, 0))
    : cachedPairs.totalPairs;

  let fetched = cachedPairs.pairs.length;
  while (fetched < target) {
    const start = fetched;
    const chunkSize = Math.min(ENUMERATION_BATCH, target - start);
    const indices = Array.from({ length: chunkSize }, (_, i) => BigInt(start + i));

    const results = await executeMulticall(
      client,
      indices.map((index) => ({
        address: factory,
        abi: blazeSwapFactoryV2Abi,
        functionName: 'allPairs',
        args: [index],
      })),
    );

    results.forEach((result, idx) => {
      const globalIndex = start + idx;
      const address = toChecksum(result);
      cachedPairs!.pairs[globalIndex] = address;
    });

    fetched += chunkSize;
  }

  const pairs = cachedPairs.pairs.slice(0, target).filter(Boolean) as `0x${string}`[];
  return { pairs, totalPairs: cachedPairs.totalPairs };
}

async function readBalances(
  client: FlareClient,
  wallet: `0x${string}`,
  pairs: `0x${string}`[],
): Promise<BalanceEntry[]> {
  const owned: BalanceEntry[] = [];

  for (let idx = 0; idx < pairs.length; idx += BALANCE_BATCH) {
    const chunk = pairs.slice(idx, idx + BALANCE_BATCH);
    const results = await executeMulticall(
      client,
      chunk.map((pair) => ({
        address: pair,
        abi: blazeSwapPairV2Abi,
        functionName: 'balanceOf',
        args: [wallet],
      })),
    );

    results.forEach((result, pos) => {
      const balance = toBigInt(result);
      if (!balance || balance === 0n) {
        return;
      }
      owned.push({
        address: chunk[pos],
        balance,
      });
    });
  }

  return owned;
}

function computeSharePct(balance: bigint, totalSupply: bigint): number {
  if (totalSupply === 0n) {
    return 0;
  }
  const SCALE = 1_000_000n;
  const scaled = (balance * (100n * SCALE)) / totalSupply;
  return Number(scaled) / Number(SCALE);
}

async function enrichPositions(
  client: FlareClient,
  entries: BalanceEntry[],
): Promise<BlazeSwapV2Position[]> {
  const positions: BlazeSwapV2Position[] = [];

  for (let idx = 0; idx < entries.length; idx += DETAIL_BATCH) {
    const chunk = entries.slice(idx, idx + DETAIL_BATCH);

    const calls = chunk.flatMap((entry) => [
      {
        address: entry.address,
        abi: blazeSwapPairV2Abi,
        functionName: 'token0',
      },
      {
        address: entry.address,
        abi: blazeSwapPairV2Abi,
        functionName: 'token1',
      },
      {
        address: entry.address,
        abi: blazeSwapPairV2Abi,
        functionName: 'getReserves',
      },
      {
        address: entry.address,
        abi: blazeSwapPairV2Abi,
        functionName: 'totalSupply',
      },
    ] as const);

    const results = await executeMulticall(client, calls);

    chunk.forEach((entry, positionIndex) => {
      const base = positionIndex * 4;
      const token0 = toChecksum(results[base]);
      const token1 = toChecksum(results[base + 1]);
      const reservesRaw = results[base + 2];
      const totalSupply = toBigInt(results[base + 3]);

      if (!token0 || !token1 || !totalSupply) {
        return;
      }

      const reservesArray = Array.isArray(reservesRaw) ? reservesRaw : null;
      const reserve0 = reservesArray ? toBigInt(reservesArray[0]) : null;
      const reserve1 = reservesArray ? toBigInt(reservesArray[1]) : null;

      if (reserve0 === null || reserve1 === null) {
        return;
      }

      const sharePct = computeSharePct(entry.balance, totalSupply);
      const amount0 =
        totalSupply === 0n ? 0n : (entry.balance * reserve0) / totalSupply;
      const amount1 =
        totalSupply === 0n ? 0n : (entry.balance * reserve1) / totalSupply;

      positions.push({
        provider: 'blazeswap-v2',
        type: 'v2',
        pair: entry.address,
        token0: { address: token0 },
        token1: { address: token1 },
        balance: entry.balance.toString(),
        totalSupply: totalSupply.toString(),
        reserves: {
          r0: reserve0.toString(),
          r1: reserve1.toString(),
        },
        sharePct,
        amount0: amount0.toString(),
        amount1: amount1.toString(),
        status: 'active',
      });
    });
  }

  return positions;
}

export function isBlazeSwapConfigured(): boolean {
  return getFactoryAddress() !== null;
}

export async function positionsForWallet(
  wallet: `0x${string}`,
  opts?: { maxPairs?: number },
): Promise<{ positions: BlazeSwapV2Position[]; meta: BlazeSwapV2Meta }> {
  const factory = getFactoryAddress();
  if (!factory) {
    return { positions: [], meta: { scanned: 0, totalPairs: 0 } };
  }

  const client = getFlareClient() ?? flare;
  const { pairs, totalPairs } = await ensurePairAddresses(
    client,
    factory,
    opts?.maxPairs,
  );

  if (pairs.length === 0) {
    return { positions: [], meta: { scanned: 0, totalPairs } };
  }

  const balances = await readBalances(client, wallet, pairs);
  if (balances.length === 0) {
    return { positions: [], meta: { scanned: pairs.length, totalPairs } };
  }

  const positions = await enrichPositions(client, balances);

  return {
    positions,
    meta: {
      scanned: pairs.length,
      totalPairs,
    },
  };
}

export async function probeBlazeSwapPairs(): Promise<{
  configured: boolean;
  ready: boolean;
  totalPairs: number | null;
}> {
  const factory = getFactoryAddress();
  if (!factory) {
    return { configured: false, ready: false, totalPairs: null };
  }

  try {
    const client = getFlareClient() ?? flare;
    const totalPairsRaw = await client.readContract({
      address: factory,
      abi: blazeSwapFactoryV2Abi,
      functionName: 'allPairsLength',
    });

    return {
      configured: true,
      ready: true,
      totalPairs: toNumber(totalPairsRaw as bigint),
    };
  } catch (error) {
    console.error('[blazeswap-v2] Failed to probe factory', error);
    return { configured: true, ready: false, totalPairs: null };
  }
}
