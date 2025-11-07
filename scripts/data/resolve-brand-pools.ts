import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Address, createPublicClient, http } from 'viem';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const eq = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

type PriceMap = Record<string, number>;
type CsvRow = {
  dex: string;
  pair: string;
  fee_bps: number;
  flarescan_url: string | null;
  priority: string;
};

type TokenRegistryEntry = {
  address: string;
  decimals: number;
};

type SnapshotPool = {
  dex: string;
  pair: {
    symbol0: string;
    symbol1: string;
    fee_bps: number;
  };
  token0: {
    symbol: string;
    address: string | null;
    decimals: number | null;
  };
  token1: {
    symbol: string;
    address: string | null;
    decimals: number | null;
  };
  poolAddress: string | null;
  flarescan_url: string | null;
  tvlUsd: number | null;
  fees24hUsd: number | null;
  incentivesUsd: number | null;
  status: 'in' | 'near' | 'out' | 'ended';
  priority: string;
  updatedAt: string;
  sourceLabel: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');
const CONFIG_DIR = path.join(ROOT_DIR, 'config');
const OUTPUT_PATH = path.join(ROOT_DIR, 'public', 'brand.pools.json');

const FACTORY_ENV: Record<string, string> = {
  enosys: 'ENOSYS_V3_FACTORY',
  sparkdex: 'SPARKDEX_V3_FACTORY',
};

const flareChain = {
  id: 14,
  name: 'Flare',
  network: 'flare',
  nativeCurrency: {
    decimals: 18,
    name: 'Flare',
    symbol: 'FLR',
  },
  rpcUrls: {
    default: {
      http: [process.env.FLARE_RPC_URL ?? 'https://flare.public-rpc.com'],
    },
  },
} as const;

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
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

const POOL_V3_ABI = [
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

const UNISWAP_V3_FACTORY_ABI = [
  {
    type: 'function',
    name: 'getPool',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
  },
] as const;

function toFeeTier(feeBps: number): number {
  return Math.round(feeBps * 100);
}

function parseCsv(content: string): CsvRow[] {
  const [headerLine, ...lines] = content.trim().split(/\r?\n/);
  const headers = headerLine.split(',').map((value) => value.trim());
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(',').map((value) => value.trim());
      const row = Object.fromEntries(headers.map((key, index) => [key, cells[index] ?? ''])) as Record<
        string,
        string
      >;
      return {
        dex: row.dex,
        pair: row.pair,
        fee_bps: Number.parseInt(row.fee_bps, 10),
        flarescan_url: row.flarescan_url ? row.flarescan_url : null,
        priority: row.priority ?? '',
      };
    });
}

async function loadTokenRegistry(): Promise<Record<string, TokenRegistryEntry>> {
  const registryPath = path.join(CONFIG_DIR, 'token_registry.json');
  const content = await fs.readFile(registryPath, 'utf8');
  return JSON.parse(content) as Record<string, TokenRegistryEntry>;
}

function normaliseSymbol(symbol: string): string {
  return symbol.trim();
}

function isAddress(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function parsePoolAddressFromUrl(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/address\/(0x[a-fA-F0-9]{40})/);
  return match ? match[1] : null;
}

type BrandConfig = {
  minTvlUsd: number;
  requestDelayMs: number;
  maxRows: number;
  sourceLabel: string;
  price: {
    source: string;
    endpoint: string;
    timeoutMs: number;
  };
  stableMap: Record<string, number>;
};

const priceCache = new Map<string, number>();

async function fetchPrices(
  addresses: string[],
  cfg: BrandConfig,
  registry: Record<string, TokenRegistryEntry>,
): Promise<PriceMap> {
  const result: PriceMap = {};
  const unique = Array.from(new Set(addresses.map((addr) => addr.toLowerCase())));

  for (const addr of unique) {
    if (priceCache.has(addr)) {
      result[addr] = priceCache.get(addr)!;
    }
  }

  if (cfg.stableMap) {
    for (const [symbol, usd] of Object.entries(cfg.stableMap)) {
      const regEntry = registry[symbol];
      if (!regEntry?.address) continue;
      const addr = regEntry.address.toLowerCase();
      if (!unique.includes(addr)) continue;
      const price = Number(usd);
      if (!Number.isFinite(price)) continue;
      priceCache.set(addr, price);
      result[addr] = price;
    }
  }

  const unresolved = unique.filter((addr) => result[addr] === undefined);
  if (unresolved.length === 0) return result;

  const endpoint = cfg.price?.endpoint?.replace(/\/$/, '');
  if (!endpoint) return result;

  const query = unresolved.map((addr) => `flare:${addr}`).join(',');
  const url = `${endpoint}/${query}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.price?.timeoutMs ?? 4000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) {
      const payload = await response.json();
      const coins = payload?.coins ?? {};
      for (const addr of unresolved) {
        const key = `flare:${addr}`;
        const price = coins[key]?.price;
        if (typeof price === 'number' && Number.isFinite(price)) {
          priceCache.set(addr, price);
          result[addr] = price;
        }
      }
    }
  } catch {
    // swallow — partial prices are fine
  }

  return result;
}

async function getTokenMeta(
  address: `0x${string}`,
  registry: Record<string, TokenRegistryEntry>,
  client: ReturnType<typeof createPublicClient>,
) {
  const registryEntry = Object.values(registry).find((entry) => eq(entry.address, address));
  const decimals =
    registryEntry?.decimals ??
    (await client
      .readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'decimals',
      })
      .catch(() => 18));

  return {
    address,
    decimals: Number(decimals),
  };
}

async function enrichPoolTvlUsd(
  poolAddress: `0x${string}`,
  cfg: BrandConfig,
  registry: Record<string, TokenRegistryEntry>,
  client: ReturnType<typeof createPublicClient>,
): Promise<number | null> {
  try {
    const [token0Address, token1Address] = (await Promise.all([
      client.readContract({ address: poolAddress, abi: POOL_V3_ABI, functionName: 'token0' }),
      client.readContract({ address: poolAddress, abi: POOL_V3_ABI, functionName: 'token1' }),
    ])) as [`0x${string}`, `0x${string}`];

    const [meta0, meta1] = await Promise.all([
      getTokenMeta(token0Address, registry, client),
      getTokenMeta(token1Address, registry, client),
    ]);

    const [balance0, balance1] = await Promise.all([
      client
        .readContract({
          address: meta0.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [poolAddress],
        })
        .catch(() => 0n),
      client
        .readContract({
          address: meta1.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [poolAddress],
        })
        .catch(() => 0n),
    ]);

    const amount0 = Number(balance0) / 10 ** meta0.decimals;
    const amount1 = Number(balance1) / 10 ** meta1.decimals;

    const prices = await fetchPrices([meta0.address, meta1.address], cfg, registry);
    const price0 = prices[meta0.address.toLowerCase()];
    const price1 = prices[meta1.address.toLowerCase()];

    const value0 = typeof price0 === 'number' ? amount0 * price0 : null;
    const value1 = typeof price1 === 'number' ? amount1 * price1 : null;

    if (value0 === null && value1 === null) {
      return null;
    }

    return (value0 ?? 0) + (value1 ?? 0);
  } catch {
    return null;
  }
}

async function resolvePools(): Promise<SnapshotPool[]> {
  const csvPath = path.join(CONFIG_DIR, 'brand_pools.csv');
  const csvContent = await fs.readFile(csvPath, 'utf8');
  const rows = parseCsv(csvContent);
  const registry = await loadTokenRegistry();
  const now = new Date().toISOString();

  const rpcUrl = process.env.FLARE_RPC_URL ?? flareChain.rpcUrls.default.http[0];
  const client = createPublicClient({
    chain: flareChain,
    transport: http(rpcUrl),
  });

  const results: SnapshotPool[] = [];

  for (const row of rows) {
    const [symbol0Raw, symbol1Raw] = row.pair.split('/').map((value) => value.trim());
    const symbol0 = normaliseSymbol(symbol0Raw);
    const symbol1 = normaliseSymbol(symbol1Raw);

    const token0 = registry[symbol0];
    const token1 = registry[symbol1];

    if (!token0 || token0.address === 'TODO') {
      console.warn(`[brand pools] TODO: token address missing for ${symbol0}`);
    }
    if (!token1 || token1.address === 'TODO') {
      console.warn(`[brand pools] TODO: token address missing for ${symbol1}`);
    }

    const token0Address = token0 && token0.address !== 'TODO' ? token0.address : null;
    const token1Address = token1 && token1.address !== 'TODO' ? token1.address : null;

    let poolAddress: string | null = null;
    let flarescanUrl = row.flarescan_url ?? null;

    const factoryEnvKey = FACTORY_ENV[row.dex];
    const factoryAddress = factoryEnvKey ? process.env[factoryEnvKey] : undefined;

    const canAutoResolve =
      isAddress(factoryAddress ?? null) && isAddress(token0Address) && isAddress(token1Address);

    if (canAutoResolve) {
      const addresses = [token0Address as Address, token1Address as Address].sort(
        (a, b) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1),
      ) as [Address, Address];

      try {
        const pool = await client.readContract({
          address: factoryAddress as Address,
          abi: UNISWAP_V3_FACTORY_ABI,
          functionName: 'getPool',
          args: [addresses[0], addresses[1], toFeeTier(row.fee_bps)],
        });

        if (pool && pool !== '0x0000000000000000000000000000000000000000') {
          poolAddress = pool;
          if (!flarescanUrl) {
            flarescanUrl = `https://flarescan.com/address/${pool}?chainid=14`;
          }
        } else {
          console.warn(
            `[brand pools] Warning: factory returned zero address for ${row.dex} ${row.pair} (${row.fee_bps} bps).`,
          );
        }
      } catch (error) {
        console.warn(
          `[brand pools] Warning: failed to auto-resolve ${row.dex} ${row.pair}: ${(error as Error).message}`,
        );
      }

      await wait(350);
    }

    if (!poolAddress && flarescanUrl) {
      const parsed = parsePoolAddressFromUrl(flarescanUrl);
      if (parsed) {
        poolAddress = parsed;
      } else {
        console.warn(`[brand pools] Warning: unable to parse pool address from URL for ${row.pair}`);
      }
    }

    if (!poolAddress) {
      console.warn(`[brand pools] TODO: pool address unresolved for ${row.dex} ${row.pair}`);
    } else if (!flarescanUrl) {
      flarescanUrl = `https://flarescan.com/address/${poolAddress}?chainid=14`;
    }

    results.push({
      dex: row.dex,
      pair: {
        symbol0,
        symbol1,
        fee_bps: row.fee_bps,
      },
      token0: {
        symbol: symbol0,
        address: token0Address,
        decimals: token0?.decimals ?? null,
      },
      token1: {
        symbol: symbol1,
        address: token1Address,
        decimals: token1?.decimals ?? null,
      },
      poolAddress,
      flarescan_url: flarescanUrl,
      tvlUsd: null,
      fees24hUsd: null,
      incentivesUsd: null,
      status: 'in',
      priority: row.priority,
      updatedAt: now,
      sourceLabel: '',
    });
  }

  // configuration
  const defaultConfig: BrandConfig = {
    minTvlUsd: 1000,
    requestDelayMs: 500,
    maxRows: 12,
    sourceLabel: 'on-chain snapshot',
    price: {
      source: 'defillama',
      endpoint: 'https://coins.llama.fi/prices/current',
      timeoutMs: 4000,
    },
    stableMap: {
      USDTe: 1,
      'USDC.e': 1,
    },
  };

  let config: BrandConfig = { ...defaultConfig };
  try {
    const brandConfigPath = path.join(CONFIG_DIR, 'brand.json');
    const rawConfig = await fs.readFile(brandConfigPath, 'utf8');
    const parsed = JSON.parse(rawConfig);
    config = {
      ...config,
      minTvlUsd:
        typeof parsed?.minTvlUsd === 'number' && Number.isFinite(parsed.minTvlUsd)
          ? parsed.minTvlUsd
          : config.minTvlUsd,
      requestDelayMs:
        typeof parsed?.requestDelayMs === 'number' && parsed.requestDelayMs >= 0
          ? parsed.requestDelayMs
          : config.requestDelayMs,
      maxRows:
        typeof parsed?.maxRows === 'number' && parsed.maxRows > 0 ? Math.floor(parsed.maxRows) : config.maxRows,
      sourceLabel:
        typeof parsed?.sourceLabel === 'string' && parsed.sourceLabel.trim()
          ? parsed.sourceLabel
          : config.sourceLabel,
      price: {
        ...config.price,
        ...(typeof parsed?.price === 'object' && parsed.price
          ? {
              source:
                typeof parsed.price.source === 'string' && parsed.price.source.trim()
                  ? parsed.price.source
                  : config.price.source,
              endpoint:
                typeof parsed.price.endpoint === 'string' && parsed.price.endpoint.trim()
                  ? parsed.price.endpoint
                  : config.price.endpoint,
              timeoutMs:
                typeof parsed.price.timeoutMs === 'number' && parsed.price.timeoutMs >= 0
                  ? parsed.price.timeoutMs
                  : config.price.timeoutMs,
            }
          : {}),
      },
      stableMap: {
        ...config.stableMap,
        ...(typeof parsed?.stableMap === 'object' && parsed.stableMap ? parsed.stableMap : {}),
      },
    };
  } catch {
    console.warn('[brand pools] config/brand.json not found, using defaults.');
  }

  for (const entry of results) {
    entry.sourceLabel = config.sourceLabel;

    if (!entry.poolAddress) {
      console.warn(
        `[brand pools] Skipping on-chain enrichment for ${entry.dex} ${entry.pair.symbol0}/${entry.pair.symbol1} — pool address missing`,
      );
      entry.tvlUsd = null;
      entry.fees24hUsd = null;
      entry.incentivesUsd = null;
      entry.updatedAt = new Date().toISOString();
      continue;
    }

    entry.tvlUsd = await enrichPoolTvlUsd(entry.poolAddress as `0x${string}`, config, registry, client);
    entry.fees24hUsd = null;
    entry.incentivesUsd = null;
    entry.updatedAt = new Date().toISOString();

    if (config.requestDelayMs > 0) {
      await wait(config.requestDelayMs);
    }
  }

  const minted = results.filter(
    (entry) =>
      typeof entry.tvlUsd === 'number' &&
      Number.isFinite(entry.tvlUsd) &&
      (entry.tvlUsd as number) >= config.minTvlUsd,
  );

  const finalRows = minted.slice(0, config.maxRows ?? minted.length);

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(finalRows, null, 2), 'utf8');

  return finalRows;
}

async function main() {
  try {
    const snapshot = await resolvePools();
    console.info(
      `[brand pools] On-chain TVL snapshot → ${OUTPUT_PATH} (${snapshot.length} rows)`,
    );
  } catch (error) {
    console.error('[brand pools] Failed to build snapshot', error);
    process.exitCode = 1;
  }
}

main();
