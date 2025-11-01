/* eslint-disable no-console */
import { isAddress, getAddress, parseAbiItem } from 'viem';
import pLimit from 'p-limit';

import { db } from '@/lib/data/db';
import { env, type ProviderKey } from '@/lib/env';
import { publicClient } from '@/lib/viemClient';
import { getProviderConfig } from '@/services/providerConfig';

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
);

export interface DiscoveryOutcome {
  provider: ProviderKey;
  source: string;
  found: number;
  inserted: number;
  updated: number;
  skipped: number;
}

export interface SampleWalletsOptions {
  limit: number;
  minScore?: number;
  providers?: ProviderKey[];
}

export interface SampledWallet {
  address: string;
  score: number;
  providers: ProviderKey[];
  lastSeen: string;
}

export interface SampleWalletsResult {
  wallets: SampledWallet[];
  totalAvailable: number;
}

function isValidAddr(address: unknown): address is `0x${string}` {
  if (typeof address !== 'string') return false;
  try {
    if (!isAddress(address as `0x${string}`)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function checksum(address: string): string | null {
  if (!isValidAddr(address)) return null;
  try {
    return getAddress(address);
  } catch {
    return null;
  }
}

function collectMaybeAddress(value: unknown, bucket: Set<string>) {
  if (typeof value === 'string') {
    const normalized = checksum(value);
    if (normalized) bucket.add(normalized);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectMaybeAddress(entry, bucket));
    return;
  }

  if (value && typeof value === 'object') {
    const potentialKeys = [
      'address',
      'wallet',
      'owner',
      'recipient',
      'to',
      'account',
      'user',
    ];
    for (const key of potentialKeys) {
      if (key in (value as Record<string, unknown>)) {
        collectMaybeAddress((value as Record<string, unknown>)[key], bucket);
      }
    }
  }
}

async function upsertWallet(address: string, scoreDelta: number) {
  const checksumAddress = checksum(address);
  if (!checksumAddress) {
    return { inserted: 0, updated: 0 };
  }

  const lower = checksumAddress.toLowerCase();

  const existing = await db.discoveredWallet.findUnique({
    where: { address: checksumAddress },
  });

  if (existing) {
    await db.discoveredWallet.update({
      where: { address: checksumAddress },
      data: {
        score: {
          increment: scoreDelta,
        },
      },
    });
    return { inserted: 0, updated: 1 };
  }

  const count = await db.discoveredWallet.count();
  if (count >= env.discovery.maxWallets) {
    return { inserted: 0, updated: 0 };
  }

  await db.discoveredWallet.create({
    data: {
      address: checksumAddress,
      addressLower: lower,
      score: scoreDelta,
    },
  });

  return { inserted: 1, updated: 0 };
}

export async function bulkUpsertWallets(
  provider: ProviderKey,
  source: string,
  addresses: Iterable<string>,
  meta?: { txHash?: string; block?: bigint | number },
): Promise<DiscoveryOutcome> {
  const unique = new Set<string>();
  for (const addr of addresses) {
    const normalized = checksum(addr);
    if (normalized) {
      unique.add(normalized);
    }
  }

  if (unique.size === 0) {
    return {
      provider,
      source,
      found: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
    };
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const limit = pLimit(4);

  await Promise.all(
    Array.from(unique).map((address) =>
      limit(async () => {
        try {
          const result = await upsertWallet(address, 1);

          await db.discoveredWalletSource.create({
            data: {
              walletAddress: address,
              provider,
              source,
              txHash: meta?.txHash,
              block: meta?.block ? BigInt(meta.block) : undefined,
            },
          });

          inserted += result.inserted;
          updated += result.updated;
        } catch (error) {
          skipped += 1;
          console.warn('[walletDiscovery] Failed to upsert', address, error);
        }
      }),
    ),
  );

  return {
    provider,
    source,
    found: unique.size,
    inserted,
    updated,
    skipped,
  };
}

export async function discoverFromIncentives(provider: ProviderKey): Promise<DiscoveryOutcome> {
  const config = getProviderConfig(provider);
  if (!config.incentivesApi) {
    return {
      provider,
      source: 'incentives',
      found: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
    };
  }

  try {
    const response = await fetch(config.incentivesApi, {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Incentives API responded with ${response.status}`);
    }

    const data = await response.json();
    const addresses = new Set<string>();
    collectMaybeAddress(data, addresses);

    return bulkUpsertWallets(provider, 'incentives', addresses);
  } catch (error) {
    console.warn(`[walletDiscovery] Incentives fetch failed for ${provider}:`, error);
    return {
      provider,
      source: 'incentives',
      found: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
    };
  }
}

export async function discoverFromPositionManager(provider: ProviderKey): Promise<DiscoveryOutcome> {
  const config = getProviderConfig(provider);
  if (!config.positionManager) {
    return {
      provider,
      source: 'pm-transfer',
      found: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
    };
  }

  try {
    const latestBlock = await publicClient.getBlockNumber();
    const maxRange = env.discovery.maxBlockRange;
    const range = maxRange > 0n ? maxRange : 50_000n;

    let fromBlock = config.fromBlock > 0n ? config.fromBlock : latestBlock - range;
    if (fromBlock < 0n) fromBlock = 0n;

    const toBlock = latestBlock;

    const logs = await publicClient.getLogs({
      address: config.positionManager as `0x${string}`,
      event: TRANSFER_EVENT,
      fromBlock,
      toBlock,
    });

    const addresses = new Set<string>();
    logs.forEach((log) => {
      if (log.args?.to) {
        collectMaybeAddress(log.args.to, addresses);
      }
    });

    return bulkUpsertWallets(provider, 'pm-transfer', addresses, {
      block: Number(toBlock),
    });
  } catch (error) {
    console.warn(`[walletDiscovery] Position manager scan failed for ${provider}:`, error);
    return {
      provider,
      source: 'pm-transfer',
      found: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
    };
  }
}

function shuffle<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function determineWalletProviders(sourceProviders: string[]): ProviderKey[] {
  const known: ProviderKey[] = [];
  const lowered = sourceProviders.map((p) => p.toLowerCase());
  if (lowered.some((p) => p.includes('enosys'))) {
    known.push('enosys-v3');
  }
  if (lowered.some((p) => p.includes('spark'))) {
    known.push('sparkdex-v3');
  }
  if (lowered.some((p) => p.includes('blaze'))) {
    known.push('blazeswap-v3');
  }
  return known.length > 0 ? known : ['enosys-v3'];
}

export async function sampleWallets(options: SampleWalletsOptions): Promise<SampleWalletsResult> {
  const minScore = options.minScore ?? env.discovery.minScore;
  const providersFilter =
    options.providers ?? (['enosys-v3', 'sparkdex-v3', 'blazeswap-v3'] as ProviderKey[]);

  const candidates = await db.discoveredWallet.findMany({
    where: {
      score: { gte: minScore },
      ...(providersFilter
        ? {
            sources: {
              some: {
                provider: {
                  in: providersFilter,
                },
              },
            },
          }
        : {}),
    },
    include: {
      sources: true,
    },
    orderBy: {
      score: 'desc',
    },
    take: Math.max(options.limit * 6, 120),
  });

  if (candidates.length === 0) {
    return {
      wallets: [],
      totalAvailable: 0,
    };
  }

  const providerBuckets: Record<ProviderKey, typeof candidates> = {
    'enosys-v3': [],
    'sparkdex-v3': [],
    'blazeswap-v3': [],
  };

  candidates.forEach((candidate) => {
    const providers = determineWalletProviders(candidate.sources.map((s) => s.provider));
    providers.forEach((provider) => {
      providerBuckets[provider] = providerBuckets[provider] ?? [];
      providerBuckets[provider].push(candidate);
    });
  });

  const selected: SampledWallet[] = [];
  const usedAddresses = new Set<string>();

  const providersToCover = providersFilter ?? (['enosys-v3', 'sparkdex-v3', 'blazeswap-v3'] as ProviderKey[]);

  providersToCover.forEach((provider) => {
    const bucket = shuffle(providerBuckets[provider] ?? []);
    for (const wallet of bucket) {
      if (usedAddresses.has(wallet.address)) continue;
      usedAddresses.add(wallet.address);
      selected.push({
        address: wallet.address,
        score: wallet.score,
        providers: determineWalletProviders(wallet.sources.map((s) => s.provider)),
        lastSeen: wallet.lastSeen.toISOString(),
      });
      break;
    }
  });

  const remaining = shuffle(
    candidates.filter((wallet) => !usedAddresses.has(wallet.address)),
  );

  for (const wallet of remaining) {
    if (selected.length >= options.limit) break;
    if (usedAddresses.has(wallet.address)) continue;
    usedAddresses.add(wallet.address);
    selected.push({
      address: wallet.address,
      score: wallet.score,
      providers: determineWalletProviders(wallet.sources.map((s) => s.provider)),
      lastSeen: wallet.lastSeen.toISOString(),
    });
  }

  return {
    wallets: selected.slice(0, options.limit),
    totalAvailable: candidates.length,
  };
}
