#!/usr/bin/env tsx
import path from 'node:path';
import fs from 'node:fs/promises';
import process from 'node:process';

import {
  Address,
  createPublicClient,
  http,
} from 'viem';
import { amountsFromLiquidity, getSqrtRatioAtTick } from '../lib/tickMath';

type DexSlug = 'enosys' | 'sparkdex';

type IncludeRule = {
  dex: DexSlug;
  symbol0: string;
  symbol1: string;
  fee_bps: number;
};

type BrandConfig = {
  wallets: string[];
  include: IncludeRule[];
  minUsdPosition: number;
};

type TokenRegistryEntry = {
  address?: string;
  decimals?: number;
  display?: string;
  aliases?: string[];
};

type TokenMeta = {
  address: Address;
  symbol: string;
  displaySymbol: string;
  decimals: number;
  canonicalSymbol: string;
};

type PendingPosition = {
  dex: DexSlug;
  wallet: Address;
  positionId: string;
  poolAddress: Address;
  pair: {
    symbol0: string;
    symbol1: string;
    fee_bps: number;
  };
  amount0: number | null;
  amount1: number | null;
  tokensOwed0: number | null;
  tokensOwed1: number | null;
  token0: TokenMeta;
  token1: TokenMeta;
  sqrtPriceX96: bigint;
  tick: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  updatedAt: string;
};

type BrandPosition = {
  dex: DexSlug;
  wallet: Address;
  positionId: string;
  poolAddress: Address;
  pair: { symbol0: string; symbol1: string; fee_bps: number };
  amount0: number | null;
  amount1: number | null;
  amountUsd: number | null;
  unclaimedUsd: number | null;
  status: 'in' | 'near' | 'out' | 'unknown';
  updatedAt: string;
};

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'brand_positions.json');
const TOKEN_REGISTRY_PATH = path.join(ROOT, 'config', 'token_registry.json');
const OUTPUT_PATH = path.join(ROOT, 'public', 'brand.userPositions.json');

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const;

const NFPM_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tokenOfOwnerByIndex',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'positions',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { type: 'uint96', name: 'nonce' },
      { type: 'address', name: 'operator' },
      { type: 'address', name: 'token0' },
      { type: 'address', name: 'token1' },
      { type: 'uint24', name: 'fee' },
      { type: 'int24', name: 'tickLower' },
      { type: 'int24', name: 'tickUpper' },
      { type: 'uint128', name: 'liquidity' },
      { type: 'uint256', name: 'feeGrowthInside0LastX128' },
      { type: 'uint256', name: 'feeGrowthInside1LastX128' },
      { type: 'uint128', name: 'tokensOwed0' },
      { type: 'uint128', name: 'tokensOwed1' },
    ],
  },
] as const;

const POOL_ABI = [
  {
    type: 'function',
    name: 'slot0',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'token0',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'token1',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

const FACTORY_ABI = [
  {
    type: 'function',
    name: 'getPool',
    stateMutability: 'view',
    inputs: [
      { type: 'address' },
      { type: 'address' },
      { type: 'uint24' },
    ],
    outputs: [{ type: 'address' }],
  },
] as const;

const FLARE_CHAIN = {
  id: 14,
  name: 'Flare',
  nativeCurrency: { name: 'Flare', symbol: 'FLR', decimals: 18 },
  rpcUrls: {
    default: { http: [] as string[] },
  },
} as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const [configRaw, registryRaw] = await Promise.all([
    fs.readFile(CONFIG_PATH, 'utf8'),
    fs.readFile(TOKEN_REGISTRY_PATH, 'utf8').catch(() => '{}'),
  ]);

  const config = JSON.parse(configRaw) as BrandConfig;
  const registry = JSON.parse(registryRaw) as Record<string, TokenRegistryEntry>;

  if (!Array.isArray(config.wallets) || config.wallets.length === 0) {
    throw new Error('No wallets configured in config/brand_positions.json');
  }

  if (!Array.isArray(config.include) || config.include.length === 0) {
    throw new Error('No include rules configured in config/brand_positions.json');
  }

  const rpcUrl = process.env.FLARE_RPC_URL;
  if (!rpcUrl) {
    throw new Error('FLARE_RPC_URL environment variable is required');
  }

  const nfpmMap: Record<DexSlug, string | undefined> = {
    enosys: process.env.ENOSYS_NFPM,
    sparkdex: process.env.SPARKDEX_NFPM,
  };

  const factoryMap: Record<DexSlug, string | undefined> = {
    enosys: process.env.ENOSYS_V3_FACTORY,
    sparkdex: process.env.SPARKDEX_V3_FACTORY,
  };

  for (const [dex, address] of Object.entries(nfpmMap) as Array<[DexSlug, string | undefined]>) {
    if (!address) {
      throw new Error(`Missing environment variable for ${dex} NFPM (expected ${dex.toUpperCase()}_NFPM)`);
    }
  }
  for (const [dex, address] of Object.entries(factoryMap) as Array<[DexSlug, string | undefined]>) {
    if (!address) {
      throw new Error(`Missing environment variable for ${dex} V3 factory (expected ${dex.toUpperCase()}_V3_FACTORY)`);
    }
  }

  FLARE_CHAIN.rpcUrls.default.http = [rpcUrl];

  const client = createPublicClient({
    chain: FLARE_CHAIN,
    transport: http(rpcUrl),
  });

  const aliasLookup = new Map<string, string>();
  const addrToSymbol: Record<string, string> = {};
  const registryMeta = new Map<string, { display?: string; aliases?: string[] }>();

  for (const [symbol, entry] of Object.entries(registry)) {
    if (entry?.address) {
      const lowerAddr = entry.address.toLowerCase();
      if (!(lowerAddr in addrToSymbol)) {
        addrToSymbol[lowerAddr] = symbol;
      }
    }
    const canonical = symbol.toUpperCase();
    const aliases = entry.aliases ?? [];
    registryMeta.set(canonical.toLowerCase(), { display: entry.display, aliases });
    aliasLookup.set(canonical.toLowerCase(), canonical);
    aliases.forEach((alias) => aliasLookup.set(alias.toLowerCase(), canonical));
  }

  const fetchPrices = async (addresses: string[]): Promise<Record<string, number>> => {
    const out: Record<string, number> = {};
    const uniq = Array.from(new Set(addresses.map((addr) => addr.toLowerCase())));

    for (const [key, value] of Object.entries(registry)) {
      if ((key === 'USDTe' || key === 'USDC.e') && value?.address) {
        out[(value.address as string).toLowerCase()] = 1.0;
      }
    }

    const toFetch = uniq.filter((addr) => out[addr] === undefined);
    if (toFetch.length === 0) return out;

    try {
      const query = toFetch.map((addr) => `flare:${addr}`).join(',');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(
        `https://coins.llama.fi/prices/current?coins=${encodeURI(query)}`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);

      if (response.ok) {
        const json = await response.json().catch(() => null as any);
        const coins = (json && json.coins) || {};
        for (const addr of toFetch) {
          const price = coins[`flare:${addr}`]?.price;
          if (typeof price === 'number') {
            out[addr] = price;
          }
        }
      } else {
        console.warn('[snapshot-brand-positions] price fetch failed', response.status);
      }
    } catch {
      console.warn('[snapshot-brand-positions] price fetch failed');
    }

    return out;
  };

  const canonicalSymbol = (symbol: string): string => {
    const canonical = aliasLookup.get(symbol.toLowerCase());
    return canonical ?? symbol.toUpperCase();
  };

  const getDisplaySymbol = (symbol: string): string => {
    const canonical = canonicalSymbol(symbol);
    const meta = registryMeta.get(canonical.toLowerCase());
    return meta?.display ?? canonical;
  };

  const groupedRules = new Map<DexSlug, IncludeRule[]>();
  for (const rule of config.include) {
    const key = rule.dex;
    if (!groupedRules.has(key)) {
      groupedRules.set(key, []);
    }
    groupedRules.get(key)!.push(rule);
  }

  const tokenMetaCache = new Map<string, TokenMeta>();

  const priceCache = new Map<string, number>();
  const priceRequests = new Set<string>();

  const pendingPositions: PendingPosition[] = [];

  const ensureTokenMeta = async (tokenAddress: Address): Promise<TokenMeta> => {
    const lower = tokenAddress.toLowerCase();
    const cached = tokenMetaCache.get(lower);
    if (cached) return cached;

    const [symbolRaw, decimalsRaw] = await Promise.all([
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }) as Promise<string>,
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }) as Promise<number>,
    ]);

    const canonical = canonicalSymbol(symbolRaw);
    const display = getDisplaySymbol(symbolRaw);

    const meta: TokenMeta = {
      address: tokenAddress,
      symbol: canonical,
      displaySymbol: display,
      decimals: decimalsRaw,
      canonicalSymbol: canonical,
    };

    tokenMetaCache.set(lower, meta);

    priceRequests.add(lower);

    return meta;
  };

  const toDecimal = (raw: bigint, decimals: number): number => {
    if (raw === 0n) return 0;
    const divisor = 10n ** BigInt(decimals);
    const whole = raw / divisor;
    const fraction = raw % divisor;
    const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 8).replace(/0+$/, '');
    if (fractionStr.length === 0) {
      return Number(whole);
    }
    return Number(`${whole.toString()}.${fractionStr}`);
  };

  for (const walletRaw of config.wallets) {
    const wallet = walletRaw.toLowerCase() as Address;
    for (const [dex, rules] of groupedRules.entries()) {
      const nfpmAddress = nfpmMap[dex] as string;
      const factoryAddress = factoryMap[dex] as string;
      if (!nfpmAddress || !factoryAddress) continue;

      const balance = (await client.readContract({
        address: nfpmAddress as Address,
        abi: NFPM_ABI,
        functionName: 'balanceOf',
        args: [wallet],
      })) as bigint;

      const balanceNum = Number(balance);
      if (!Number.isFinite(balanceNum) || balanceNum === 0) {
        continue;
      }

      for (let index = 0; index < balanceNum; index++) {
        const tokenId = (await client.readContract({
          address: nfpmAddress as Address,
          abi: NFPM_ABI,
          functionName: 'tokenOfOwnerByIndex',
          args: [wallet, BigInt(index)],
        })) as bigint;

        await sleep(200);

        const position = await client.readContract({
          address: nfpmAddress as Address,
          abi: NFPM_ABI,
          functionName: 'positions',
          args: [tokenId],
        });

        const liquidity = position[7] as bigint;
        if (liquidity === 0n) {
          continue;
        }

        const token0Address = position[2] as Address;
        const token1Address = position[3] as Address;
        const fee = Number(position[4]);
        const tickLower = Number(position[5]);
        const tickUpper = Number(position[6]);
        const tokensOwed0 = position[10] as bigint;
        const tokensOwed1 = position[11] as bigint;

        const token0Meta = await ensureTokenMeta(token0Address);
        const token1Meta = await ensureTokenMeta(token1Address);

        const sym0Key = addrToSymbol[token0Address.toLowerCase()] ?? 'UNKNOWN';
        const sym1Key = addrToSymbol[token1Address.toLowerCase()] ?? 'UNKNOWN';

        const matchingRule = rules.find((rule) => {
          if (fee !== rule.fee_bps * 100) return false;
          const forward = rule.symbol0 === sym0Key && rule.symbol1 === sym1Key;
          const reverse = rule.symbol0 === sym1Key && rule.symbol1 === sym0Key;
          return forward || reverse;
        });

        if (!matchingRule) {
          continue;
        }

        const poolAddress = (await client.readContract({
          address: factoryAddress as Address,
          abi: FACTORY_ABI,
          functionName: 'getPool',
          args: [token0Address, token1Address, BigInt(fee)],
        })) as Address;

        if (!poolAddress || poolAddress === '0x0000000000000000000000000000000000000000') {
          continue;
        }

        const slot0 = await client.readContract({
          address: poolAddress,
          abi: POOL_ABI,
          functionName: 'slot0',
        }) as unknown as {
          sqrtPriceX96: bigint;
          tick: number;
        };

        const sqrtPriceX96 = slot0.sqrtPriceX96;
        const tick = slot0.tick;

        let amount0: number | null = null;
        let amount1: number | null = null;

        try {
          const dec0 = Number(registry[sym0Key]?.decimals ?? token0Meta.decimals ?? 18);
          const dec1 = Number(registry[sym1Key]?.decimals ?? token1Meta.decimals ?? 18);
          const sqrtA = getSqrtRatioAtTick(tickLower);
          const sqrtB = getSqrtRatioAtTick(tickUpper);
          const { a0, a1 } = amountsFromLiquidity(liquidity, sqrtPriceX96, sqrtA, sqrtB);
          amount0 = Number(a0) / 10 ** dec0;
          amount1 = Number(a1) / 10 ** dec1;
        } catch (error) {
          console.warn('[snapshot-brand-positions] amount compute skipped', {
            tokenId: tokenId.toString(),
            reason: error instanceof Error ? error.message : String(error),
          });
          amount0 = null;
          amount1 = null;
        }

        const owed0 = tokensOwed0 ? toDecimal(tokensOwed0, token0Meta.decimals) : 0;
        const owed1 = tokensOwed1 ? toDecimal(tokensOwed1, token1Meta.decimals) : 0;

        const label0 = registry[sym0Key]?.display ?? sym0Key;
        const label1 = registry[sym1Key]?.display ?? sym1Key;

        pendingPositions.push({
          dex,
          wallet,
          positionId: tokenId.toString(),
          poolAddress,
          pair: {
            symbol0: label0,
            symbol1: label1,
            fee_bps: matchingRule.fee_bps,
          },
          amount0,
          amount1,
          tokensOwed0: owed0,
          tokensOwed1: owed1,
          token0: token0Meta,
          token1: token1Meta,
          sqrtPriceX96,
          tick,
          tickLower,
          tickUpper,
          liquidity,
          updatedAt: new Date().toISOString(),
        });

        await sleep(200);
      }
    }
  }

  const fetchedPrices = await fetchPrices(Array.from(priceRequests));
  for (const [addr, price] of Object.entries(fetchedPrices)) {
    if (typeof price === 'number' && Number.isFinite(price)) {
      priceCache.set(addr.toLowerCase(), price);
    }
  }

  const toUsd = (amount: number | null, token: TokenMeta): number | null => {
    if (amount === null) return null;
    const price = priceCache.get(token.address.toLowerCase());
    if (typeof price !== 'number' || !Number.isFinite(price)) {
      return null;
    }
    return amount * price;
  };

  const positions: BrandPosition[] = pendingPositions
    .map((pending) => {
      const price0 = toUsd(pending.amount0, pending.token0);
      const price1 = toUsd(pending.amount1, pending.token1);

      const owedUsd0 = toUsd(pending.tokensOwed0, pending.token0);
      const owedUsd1 = toUsd(pending.tokensOwed1, pending.token1);

      let amountUsd: number | null = null;
      if (price0 !== null || price1 !== null) {
        amountUsd = (price0 ?? 0) + (price1 ?? 0);
      }

      let unclaimedUsd: number | null = null;
      if (owedUsd0 !== null || owedUsd1 !== null) {
        unclaimedUsd = (owedUsd0 ?? 0) + (owedUsd1 ?? 0);
      }

      let status: 'in' | 'near' | 'out' | 'unknown' = 'unknown';
      const tickCur = Number(pending.tick);
      const tickLower = Number(pending.tickLower);
      const tickUpper = Number(pending.tickUpper);
      if (Number.isFinite(tickCur) && Number.isFinite(tickLower) && Number.isFinite(tickUpper)) {
        if (tickCur <= tickLower) {
          status = 'out';
        } else if (tickCur >= tickUpper) {
          status = 'in';
        } else {
          status = 'near';
        }
      }

      return {
        dex: pending.dex,
        wallet: pending.wallet,
        positionId: pending.positionId,
        poolAddress: pending.poolAddress,
        pair: pending.pair,
        amount0: pending.amount0,
        amount1: pending.amount1,
        amountUsd,
        unclaimedUsd,
        status,
        updatedAt: pending.updatedAt,
      };
    })
    .sort((a, b) => {
      const aUsd = a.amountUsd ?? 0;
      const bUsd = b.amountUsd ?? 0;
      return bUsd - aUsd;
    });

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(positions, null, 2));
  console.log(
    `[snapshot-brand-user-positions] Wrote ${positions.length} position(s) to ${path.relative(
      ROOT,
      OUTPUT_PATH,
    )}`,
  );
}

main().catch((error) => {
  console.error('[snapshot-brand-user-positions] Failed:', error);
  process.exitCode = 1;
});
