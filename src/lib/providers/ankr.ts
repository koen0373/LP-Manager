import { getAddress, type Address } from 'viem';

import { publicClient } from '@/lib/viemClient';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

type NfpmConfig = {
  address: Address;
  fromBlock: bigint;
};

const NFPM_CONFIGS: NfpmConfig[] = [
  process.env.ENOSYS_NFPM
    ? {
        address: getAddress(process.env.ENOSYS_NFPM as `0x${string}`),
        fromBlock: BigInt(process.env.ENOSYS_NFPM_START_BLOCK ?? 0),
      }
    : null,
  process.env.SPARKDEX_NFPM
    ? {
        address: getAddress(process.env.SPARKDEX_NFPM as `0x${string}`),
        fromBlock: BigInt(process.env.SPARKDEX_NFPM_START_BLOCK ?? 0),
      }
    : null,
].filter((entry): entry is NfpmConfig => Boolean(entry));

const NFT_CACHE = new Map<string, { expires: number; tokenIds: bigint[] }>();
const NFT_CACHE_TTL_MS = 120_000;
const LOG_CHUNK = 10_000n;

const ERC721_ENUMERABLE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tokenOfOwnerByIndex',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
] as const;

const TRANSFER_EVENT = {
  type: 'event',
  name: 'Transfer',
  inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
  ],
} as const;

export async function nftsByOwner(owner: string): Promise<bigint[]> {
  if (!ADDRESS_REGEX.test(owner) || !NFPM_CONFIGS.length) {
    return [];
  }

  let normalizedOwner: Address;
  try {
    normalizedOwner = getAddress(owner);
  } catch {
    return [];
  }

  const results = await Promise.all(NFPM_CONFIGS.map((config) => enumerateForConfig(config, normalizedOwner)));
  const unique = new Set<string>();
  results.forEach((list) => {
    list.forEach((tokenId) => unique.add(tokenId.toString()));
  });
  return Array.from(unique).map((value) => BigInt(value));
}

async function enumerateForConfig(config: NfpmConfig, owner: Address): Promise<bigint[]> {
  const cacheKey = `${config.address}:${owner.toLowerCase()}`;
  const cached = NFT_CACHE.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.tokenIds;
  }

  const tokens =
    (await enumerateViaEnumerable(config.address, owner).catch(() => enumerateViaLogs(config, owner)))
    ?? [];

  NFT_CACHE.set(cacheKey, { expires: Date.now() + NFT_CACHE_TTL_MS, tokenIds: tokens });
  return tokens;
}

async function enumerateViaEnumerable(nfpm: Address, owner: Address): Promise<bigint[]> {
  const balance = await publicClient.readContract({
    address: nfpm,
    abi: ERC721_ENUMERABLE_ABI,
    functionName: 'balanceOf',
    args: [owner],
  }) as bigint;

  const tokenIds: bigint[] = [];
  for (let i = 0n; i < balance; i += 1n) {
    const tokenId = await publicClient.readContract({
      address: nfpm,
      abi: ERC721_ENUMERABLE_ABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [owner, i],
    }) as bigint;
    tokenIds.push(tokenId);
  }

  return tokenIds;
}

async function enumerateViaLogs(config: NfpmConfig, owner: Address): Promise<bigint[]> {
  const fromBlock = config.fromBlock ?? 0n;
  const latest = await publicClient.getBlockNumber();
  const tokenIds = new Set<bigint>();

  for (let start = fromBlock; start <= latest; start += LOG_CHUNK) {
    const end = start + LOG_CHUNK - 1n;
    try {
      const logs = await publicClient.getLogs({
        address: config.address,
        event: TRANSFER_EVENT,
        args: { to: owner },
        fromBlock: start,
        toBlock: end > latest ? latest : end,
      });

      logs.forEach((log) => {
        const tokenId = log.args?.tokenId as bigint | undefined;
        if (typeof tokenId === 'bigint') {
          tokenIds.add(tokenId);
        }
      });
    } catch (error) {
      console.warn('[nfpm] log scan error', error);
      break;
    }
  }

  return Array.from(tokenIds);
}
