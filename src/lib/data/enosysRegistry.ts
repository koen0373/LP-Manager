// src/lib/data/enosysRegistry.ts
import { createPublicClient, http, keccak256, toHex } from 'viem';
import type { Abi } from 'viem';

const client = createPublicClient({
  transport: http(process.env.NEXT_PUBLIC_RPC_URL ?? 'https://flare.flr.finance/ext/bc/C/rpc'),
});

export const REGISTRY = '0xaD67FE666660Fb8dFE9d6b1b4240d8650e30F6019' as const;

// Kandidaten die we in de registry kunnen proberen
const ABI_VARIANTS = [
  // string varianten
  {
    fn: 'getContractAddress',
    abi: ['function getContractAddress(string) view returns (address)'] as const,
    args: (k: string) => [k] as const,
  },
  {
    fn: 'contracts',
    abi: ['function contracts(string) view returns (address)'] as const,
    args: (k: string) => [k] as const,
  },

  // bytes32 varianten
  {
    fn: 'getContractAddressByHash',
    abi: ['function getContractAddressByHash(bytes32) view returns (address)'] as const,
    args: (k: string) => [keccak256(toHex(k))] as const,
  },
  {
    fn: 'contracts',
    abi: ['function contracts(bytes32) view returns (address)'] as const,
    args: (k: string) => [keccak256(toHex(k))] as const,
  },
] as const;

// Fallback voor als geen van de ABI-varianten werkt: raw eth_call met selector
const RAW_SELECTORS = [
  { sig: 'getContractAddress(bytes32)',     selector: '0x0b1889f2' }, // keccak4('getContractAddress(bytes32)')
  { sig: 'getContractAddressByHash(bytes32)', selector: '0x4fc57a21' }, // keccak4(...)
  { sig: 'contracts(bytes32)',              selector: '0x4e6213ee' },
];

// helper: decode 32-byte result in address
function decodeAddress(ret: `0x${string}`): `0x${string}` {
  if (!ret || ret.length < 2+64) return '0x0000000000000000000000000000000000000000';
  const addr = '0x' + ret.slice(-40);
  return addr as `0x${string}`;
}

export const REGISTRY_KEYS = [
  'IncentivesController',
  'RewardsDistributor',
  'Incentives',
  'FarmingManager',
  'LiquidityMining',
  'RewardManager', // Toegevoegd gebaseerd op Enosys code
  'EnosysRewardManager', // Mogelijke variant
  'DexRewardManager', // Mogelijke variant
];

/** Probeert alle varianten totdat er een geldig adres terugkomt */
export async function resolveContractFromRegistry(key: string): Promise<`0x${string}`> {
  // 1) probeer ABI varianten
  for (const v of ABI_VARIANTS) {
    try {
      const addr = await client.readContract({
        address: REGISTRY,
        abi: v.abi as unknown as Abi,
        functionName: v.fn,
        args: v.args(key),
      }) as `0x${string}`;
      if (addr && addr !== '0x0000000000000000000000000000000000000000') return addr;
    } catch {}
  }

  // 2) raw call fallback (eth_call zonder ABI)
  const arg = keccak256(toHex(key)); // bytes32
  const padded = '0'.repeat(64 - arg.slice(2).length) + arg.slice(2); // links pad
  for (const r of RAW_SELECTORS) {
    try {
      const data = (r.selector + padded) as `0x${string}`;
      const ret = await client.call({ to: REGISTRY, data });
      const addr = decodeAddress(ret.data as `0x${string}`);
      if (addr && addr !== '0x0000000000000000000000000000000000000000') return addr;
    } catch {}
  }

  throw new Error(`Registry gaf geen adres terug voor key "${key}" (probeer andere sleutel of check implementation ABI).`);
}

/** Convenience: zoekt de eerste geldige rewards/incentives contract key */
export async function resolveAnyRewardsContract(): Promise<{ key:string; address:`0x${string}` }> {
  for (const k of REGISTRY_KEYS) {
    try {
      const a = await resolveContractFromRegistry(k);
      return { key: k, address: a };
    } catch {}
  }
  throw new Error('Geen rewards/incentives contract gevonden via registry');
}
