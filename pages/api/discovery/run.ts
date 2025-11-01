import type { NextApiRequest, NextApiResponse } from 'next';

import type { ProviderKey } from '@/lib/env';
import { discoverFromIncentives, discoverFromPositionManager } from '@/services/walletDiscoveryService';

interface DiscoveryRunResponse {
  ok: boolean;
  providers: Record<
    ProviderKey,
    {
      incentives: Awaited<ReturnType<typeof discoverFromIncentives>>;
      positionManager: Awaited<ReturnType<typeof discoverFromPositionManager>>;
    }
  >;
  totals: {
    found: number;
    inserted: number;
    updated: number;
    skipped: number;
  };
}

function toProviderKey(slug: string): ProviderKey | null {
  const lower = slug.toLowerCase();
  if (lower.startsWith('eno')) return 'enosys-v3';
  if (lower.startsWith('spark')) return 'sparkdex-v3';
  if (lower.startsWith('blaze')) return 'blazeswap-v3';
  return null;
}

function parseProviders(value: string | string[] | undefined): ProviderKey[] {
  if (!value) {
    return ['enosys-v3', 'sparkdex-v3', 'blazeswap-v3'];
  }

  const list = Array.isArray(value) ? value : value.split(',');
  const mapped = list
    .map((item) => toProviderKey(item.trim()))
    .filter((item): item is ProviderKey => item !== null);

  return mapped.length > 0 ? mapped : ['enosys-v3', 'sparkdex-v3', 'blazeswap-v3'];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DiscoveryRunResponse | { ok: false; error: string }>,
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const providers = parseProviders(req.query.providers);
  const results: DiscoveryRunResponse['providers'] = {} as DiscoveryRunResponse['providers'];

  let totalFound = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const provider of providers) {
    const [incentives, positionManager] = await Promise.all([
      discoverFromIncentives(provider),
      discoverFromPositionManager(provider),
    ]);

    totalFound += incentives.found + positionManager.found;
    totalInserted += incentives.inserted + positionManager.inserted;
    totalUpdated += incentives.updated + positionManager.updated;
    totalSkipped += incentives.skipped + positionManager.skipped;

    results[provider] = {
      incentives,
      positionManager,
    };
  }

  res.status(200).json({
    ok: true,
    providers: results,
    totals: {
      found: totalFound,
      inserted: totalInserted,
      updated: totalUpdated,
      skipped: totalSkipped,
    },
  });
}
