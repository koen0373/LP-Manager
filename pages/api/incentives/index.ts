import type { NextApiRequest, NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';
import { getAddress } from 'viem';

import { prisma } from '@/server/db';

const CACHE_HEADER = 'public, max-age=60, s-maxage=60, stale-while-revalidate=120';

function normalizePoolParam(value: string | string[] | undefined): string | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null;
  return raw.toLowerCase();
}

function checksum(address: string) {
  try {
    return getAddress(address);
  } catch (error) {
    return address;
  }
}

function mapResponse(record: { poolAddress: string; provider: string; usdPerDay: Prisma.Decimal | number | string; tokens: Prisma.JsonValue; updatedAt: Date }) {
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
    res.status(405).json({});
    return;
  }

  const normalizedPool = normalizePoolParam(req.query.pool);
  if (!normalizedPool) {
    res.status(400).json({});
    return;
  }

  try {
    const record = await prisma.poolIncentiveSnapshot.findUnique({
      where: { poolAddress: normalizedPool },
    });

    if (!record) {
      res.status(404).json({});
      return;
    }

    res.setHeader('Cache-Control', CACHE_HEADER);
    res.status(200).json(mapResponse(record));
  } catch (error) {
    res.status(500).json({});
  }
}
