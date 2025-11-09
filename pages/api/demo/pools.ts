import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

import { prisma } from '@/server/db';

const DEFAULT_LIMIT = 9;
const MAX_LIMIT = 12;
const DB_TIMEOUT_MS = 700;
const ENOSYS_FACTORY = '0x17aa157ac8c54034381b840cb8f6bf7fc355f0de';
const SPARKDEX_FACTORY = '0x8a2578d23d4c532cc9a98fad91c0523f5efde652';
const STATUS_ROTATION: Array<'in' | 'near' | 'out'> = ['in', 'near', 'out'];
const CACHE_HEADER = 'public, max-age=60, s-maxage=60, stale-while-revalidate=120';

const FALLBACK_PATH = path.join(process.cwd(), 'public', 'brand.pools.json');

type Dex = 'enosys-v3' | 'sparkdex-v3';

type PoolRow = {
  pool_address: string;
  factory: string | null;
  provider_slug: string | null;
  token0_address: string | null;
  token1_address: string | null;
  token0_symbol: string | null;
  token1_symbol: string | null;
  token0_decimals: number | null;
  token1_decimals: number | null;
  fee: number | null;
  tvl_usd: Prisma.Decimal | number | null;
  incentives_usd: Prisma.Decimal | number | null;
  snapshot_ts: Date | null;
  tick: string | null;
  liquidity: string | null;
  fees_token0: Prisma.Decimal | number | null;
  fees_token1: Prisma.Decimal | number | null;
  fees_24h_usd: Prisma.Decimal | number | null;
};

type ApiPool = {
  poolAddress: string;
  dex: Dex;
  token0: { symbol: string; address: string; decimals: number };
  token1: { symbol: string; address: string; decimals: number };
  feeBps: number;
  tvlUsd: number | null;
  fees24hUsd: number | null;
  incentivesUsd: number | null;
  status: 'in' | 'near' | 'out' | 'unknown';
};

type ApiResponse = {
  ok: boolean;
  source: 'db' | 'snapshot';
  generatedAt: string;
  items: ApiPool[];
  warnings?: string[];
};

async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse | { ok: false; reason: string }>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, reason: 'method_not_allowed' });
  }

  const limit = clamp(Math.floor(parseParam(req.query.limit, DEFAULT_LIMIT)), 1, MAX_LIMIT);
  const minTvl = Math.max(0, parseParam(req.query.minTvl, 0));
  const nowIso = new Date().toISOString();

  const warnings: string[] = [];
  let pools: ApiPool[] = [];
  let source: ApiResponse['source'] = 'db';

  try {
    const dbPools = await withTimeout(fetchPoolsFromDb(limit * 4), DB_TIMEOUT_MS);
    const filtered = filterByTvl(dbPools, minTvl);
    pools = selectDiversePools(filtered, limit);
    if (!pools.length) {
      warnings.push('db_empty');
      throw new Error('empty_result');
    }
  } catch (error) {
    if (error instanceof Error && error.message !== 'empty_result') {
      warnings.push('db_error');
    }
    try {
      const snapshotPools = await readSnapshotPools();
      const filtered = filterByTvl(snapshotPools, minTvl);
      pools = selectDiversePools(filtered, limit);
      source = 'snapshot';
    } catch (fallbackError) {
      warnings.push('snapshot_error');
      return res.status(503).json({ ok: false, reason: 'no_data' });
    }
  }

  if (!pools.length) {
    return res.status(503).json({ ok: false, reason: 'no_data' });
  }

  res.setHeader('Cache-Control', CACHE_HEADER);
  return res.status(200).json({ ok: true, source, generatedAt: nowIso, items: pools, warnings: warnings.length ? warnings : undefined });
}

function parseParam(value: string | string[] | undefined, fallback: number): number {
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function filterByTvl(pools: ApiPool[], minTvl: number): ApiPool[] {
  if (!minTvl) return pools;
  return pools.filter((pool) => (pool.tvlUsd ?? 0) >= minTvl);
}

async function fetchPoolsFromDb(limit: number): Promise<ApiPool[]> {
  const query = Prisma.sql`
    WITH latest_snapshot AS (
      SELECT
        am."poolAddress" AS pool_address,
        am."providerSlug" AS provider_slug,
        snap."tvlUsd"    AS tvl_usd,
        snap."incentiveUsd" AS incentives_usd,
        snap."ts"        AS snapshot_ts,
        ROW_NUMBER() OVER (PARTITION BY am."poolAddress" ORDER BY snap."ts" DESC) AS rn
      FROM "analytics_market" am
      JOIN "analytics_market_snapshot" snap ON snap."marketIdFk" = am."id"
      WHERE am."poolAddress" IS NOT NULL
    ),
    latest_per_pool AS (
      SELECT pool_address, provider_slug, tvl_usd, incentives_usd, snapshot_ts
      FROM latest_snapshot
      WHERE rn = 1
    )
    SELECT
      p."address"        AS pool_address,
      p."factory"        AS factory,
      latest_per_pool.provider_slug,
      p."token0"         AS token0_address,
      p."token1"         AS token1_address,
      p."token0Symbol"   AS token0_symbol,
      p."token1Symbol"   AS token1_symbol,
      p."token0Decimals" AS token0_decimals,
      p."token1Decimals" AS token1_decimals,
      p."fee"            AS fee,
      latest_per_pool.tvl_usd,
      latest_per_pool.incentives_usd,
      latest_per_pool.snapshot_ts,
      state.tick,
      state.liquidity,
      fees.fees_token0,
      fees.fees_token1,
      fees.fees_24h_usd
    FROM "Pool" p
    LEFT JOIN latest_per_pool ON latest_per_pool.pool_address = p."address"
    LEFT JOIN "mv_pool_latest_state" state ON state."pool" = p."address"
    LEFT JOIN "mv_pool_fees_24h" fees ON fees."pool" = p."address"
    WHERE LOWER(p."factory") IN (${ENOSYS_FACTORY}, ${SPARKDEX_FACTORY})
    ORDER BY COALESCE(latest_per_pool.tvl_usd, 0) DESC NULLS LAST
    LIMIT ${limit}
  `;

  const rows = await prisma.$queryRaw<PoolRow[]>(query);
  return rows.map(mapRowToPool);
}

function mapRowToPool(row: PoolRow): ApiPool {
  const poolAddress = row.pool_address;
  const dex = resolveDex(row.provider_slug, row.factory);
  const tvlUsd = toNumber(row.tvl_usd);
  const incentivesUsd = toNumber(row.incentives_usd);
  const fees24hUsd = toNumber(row.fees_24h_usd);

  return {
    poolAddress,
    dex,
    token0: {
      symbol: row.token0_symbol ?? 'T0',
      address: (row.token0_address ?? '').toLowerCase(),
      decimals: row.token0_decimals ?? 18,
    },
    token1: {
      symbol: row.token1_symbol ?? 'T1',
      address: (row.token1_address ?? '').toLowerCase(),
      decimals: row.token1_decimals ?? 18,
    },
    feeBps: row.fee ?? 0,
    tvlUsd,
    fees24hUsd,
    incentivesUsd,
    status: deriveStatus(poolAddress, tvlUsd, row.tick),
  };
}

async function readSnapshotPools(): Promise<ApiPool[]> {
  const content = await fs.readFile(FALLBACK_PATH, 'utf8');
  const parsed = JSON.parse(content) as Array<Record<string, unknown>>;
  return parsed.map((entry) => ({
    poolAddress: String(entry.poolAddress ?? entry.pool_address ?? ''),
    dex: normalizeDex(String(entry.dex ?? 'enosys')),
    token0: normalizeToken(entry.token0),
    token1: normalizeToken(entry.token1),
    feeBps: Number((entry.pair as Record<string, unknown> | undefined)?.fee_bps ?? entry.feeBps ?? 0),
    tvlUsd: toNumber(entry.tvlUsd),
    fees24hUsd: toNumber(entry.fees24hUsd),
    incentivesUsd: toNumber(entry.incentivesUsd),
    status: normalizeStatus(entry.status),
  }));
}

function normalizeToken(value: unknown): { symbol: string; address: string; decimals: number } {
  if (!value || typeof value !== 'object') {
    return { symbol: 'T', address: '', decimals: 18 };
  }
  const token = value as Record<string, unknown>;
  return {
    symbol: String(token.symbol ?? 'T'),
    address: String(token.address ?? '').toLowerCase(),
    decimals: Number(token.decimals ?? 18),
  };
}

function normalizeStatus(value: unknown): 'in' | 'near' | 'out' | 'unknown' {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'in' || normalized === 'near' || normalized === 'out') {
    return normalized;
  }
  return 'unknown';
}

function normalizeDex(value: string): Dex {
  const normalized = value.toLowerCase();
  if (normalized.includes('spark')) return 'sparkdex-v3';
  return 'enosys-v3';
}

function resolveDex(providerSlug: string | null, factory: string | null): Dex {
  const provider = providerSlug?.toLowerCase();
  if (provider?.includes('spark')) return 'sparkdex-v3';
  if (provider?.includes('eno')) return 'enosys-v3';
  const normalizedFactory = (factory ?? '').toLowerCase();
  if (normalizedFactory === SPARKDEX_FACTORY) return 'sparkdex-v3';
  return 'enosys-v3';
}

function deriveStatus(address: string | null, tvlUsd: number | null, tick: string | null): 'in' | 'near' | 'out' | 'unknown' {
  if (!address) return 'unknown';
  if (typeof tvlUsd === 'number' && tvlUsd <= 0) return 'unknown';
  const seed = address.toLowerCase() + (tick ?? '');
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i)) % 997;
  }
  return STATUS_ROTATION[hash % STATUS_ROTATION.length];
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  try {
    const num = typeof value === 'object' && 'toString' in value ? Number((value as { toString(): string }).toString()) : Number(value);
    return Number.isFinite(num) ? num : null;
  } catch {
    return null;
  }
}

function selectDiversePools(pools: ApiPool[], limit: number): ApiPool[] {
  if (!pools.length) return [];
  const buckets: Record<Dex, ApiPool[]> = {
    'enosys-v3': [],
    'sparkdex-v3': [],
  };

  pools.forEach((pool) => {
    buckets[pool.dex]?.push(pool);
  });

  Object.values(buckets).forEach((list) => list.sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0)));

  const ordered: ApiPool[] = [];
  while (ordered.length < limit && (buckets['enosys-v3'].length || buckets['sparkdex-v3'].length)) {
    for (const dex of ['enosys-v3', 'sparkdex-v3'] as const) {
      if (ordered.length >= limit) break;
      const candidate = buckets[dex].shift();
      if (candidate) {
        ordered.push(candidate);
      }
    }
  }

  if (ordered.length < limit) {
    const leftovers = pools.filter((pool) => !ordered.includes(pool));
    for (const pool of leftovers) {
      if (ordered.length >= limit) break;
      ordered.push(pool);
    }
  }

  return ordered;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}

export default handler;
