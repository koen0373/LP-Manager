import type { NextApiRequest, NextApiResponse } from 'next';

import type { ProviderKey } from '@/lib/env';
import { sampleWallets } from '@/services/walletDiscoveryService';

interface WalletsResponse {
  ok: boolean;
  count: number;
  totalAvailable: number;
  wallets: {
    address: string;
    score: number;
    providers: ProviderKey[];
    lastSeen: string;
  }[];
}

function parseNumberParam(value: string | string[] | undefined, fallback: number): number {
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

function toProviderKey(slug: string): ProviderKey | null {
  const lower = slug.toLowerCase();
  if (lower.startsWith('eno')) return 'enosys-v3';
  if (lower.startsWith('spark')) return 'sparkdex-v3';
  if (lower.startsWith('blaze')) return 'blazeswap-v3';
  return null;
}

function parseProviders(value: string | string[] | undefined): ProviderKey[] | undefined {
  if (!value) return undefined;
  const list = Array.isArray(value) ? value : value.split(',');
  const mapped = list
    .map((item) => toProviderKey(item.trim()))
    .filter((item): item is ProviderKey => item !== null);
  return mapped.length > 0 ? mapped : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<WalletsResponse | { ok: false; error: string }>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const limit = parseNumberParam(req.query.limit, 50);
  const minScore = parseNumberParam(req.query.minScore, 1);
  const providers = parseProviders(req.query.providers);

  const sample = await sampleWallets({
    limit,
    minScore,
    providers,
  });

  res.status(200).json({
    ok: true,
    count: sample.wallets.length,
    totalAvailable: sample.totalAvailable,
    wallets: sample.wallets,
  });
}
