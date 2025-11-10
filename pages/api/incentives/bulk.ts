import type { NextApiRequest, NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';
import { getAddress } from 'viem';

import { prisma } from '@/server/db';

const CACHE_HEADER = 'public, max-age=60, s-maxage=60, stale-while-revalidate=120';

function checksum(address: string) {
  try {
    return getAddress(address);
  } catch (error) {
    return address;
  }
}

function parsePoolList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => /^0x[a-fA-F0-9]{40}$/.test(entry))
    .map((entry) => entry.toLowerCase())
    .slice(0, 50);
}

function mapRecord(record: { poolAddress: string; provider: string; usdPerDay: Prisma.Decimal | number | string; tokens: Prisma.JsonValue; updatedAt: Date }) {
  return {
    pool: checksum(record.poolAddress),
    provider: record.provider,
    usdPerDay: Number(record.usdPerDay),
    tokens: Array.isArray(record.tokens) ? record.tokens : [],
    updatedAt: record.updatedAt.toISOString(),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json([]);
    return;
  }

  const pools = parsePoolList(req.query.pools);
  if (pools.length === 0) {
    res.status(200).json([]);
    return;
  }

  try {
    const records = await prisma.poolIncentiveSnapshot.findMany({
      where: { poolAddress: { in: pools } },
    });

    const mapping = new Map(records.map((record) => [record.poolAddress, record]));
    const ordered = pools
      .map((pool) => mapping.get(pool))
      .filter((record): record is NonNullable<typeof record> => Boolean(record))
      .map(mapRecord);

    res.setHeader('Cache-Control', CACHE_HEADER);
    res.status(200).json(ordered);
  } catch (error) {
    res.status(500).json([]);
  }
}
