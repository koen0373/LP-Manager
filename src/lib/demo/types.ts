/**
 * Shared types for demo pool system
 */

export type ProviderSlug = 'enosys-v3' | 'blazeswap-v3' | 'sparkdex-v2';

export type Status = 'in' | 'near' | 'out';

export interface Range {
  min: number;
  max: number;
  current: number;
}

export interface DemoPool {
  providerSlug: ProviderSlug;
  marketId: string;
  pairLabel: string;
  feeTierBps: number;
  tvlUsd: number;
  dailyFeesUsd: number;
  incentivesUsd: number;
  status: Status;
  range: Range;
  apr24hPct: number;
  // Computed fields
  strategyLabel?: 'Aggressive' | 'Balanced' | 'Conservative';
  strategyWidthPct?: number;
  unavailable?: boolean;
}

export interface WalletSeed {
  type: 'wallet';
  address: string;
  provider: ProviderSlug;
}

export interface PoolSeed {
  type: 'pool';
  provider: ProviderSlug;
  marketId: string;
}

export type DemoSeed = WalletSeed | PoolSeed;


