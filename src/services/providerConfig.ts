import type { Address } from 'viem';

import { env, type ProviderKey } from '@/lib/env';

export interface ProviderConfig {
  key: ProviderKey;
  label: string;
  incentivesApi?: string;
  positionManager?: Address;
  chainId: number;
  fromBlock: bigint;
}

function toAddress(value: string | undefined): Address | undefined {
  if (!value) return undefined;
  return value as Address;
}

export const providerConfigs: Record<ProviderKey, ProviderConfig> = {
  'enosys-v3': {
    key: 'enosys-v3',
    label: 'Enosys v3',
    incentivesApi: env.discovery.enosysIncentivesApi,
    positionManager: toAddress(env.discovery.enosysPositionManager),
    chainId: 14_605, // flare mainnet chain id
    fromBlock: env.discovery.fromBlock,
  },
  'sparkdex-v3': {
    key: 'sparkdex-v3',
    label: 'SparkDEX v3',
    incentivesApi: env.discovery.sparkdexIncentivesApi,
    positionManager: toAddress(env.discovery.sparkdexPositionManager),
    chainId: 14_605,
    fromBlock: env.discovery.fromBlock,
  },
  'blazeswap-v3': {
    key: 'blazeswap-v3',
    label: 'BlazeSwap v3',
    positionManager: toAddress(env.discovery.blazeswapPositionManager),
    chainId: 14_605,
    fromBlock: env.discovery.fromBlock,
  },
};

export function getProviderConfig(key: ProviderKey): ProviderConfig {
  return providerConfigs[key];
}
