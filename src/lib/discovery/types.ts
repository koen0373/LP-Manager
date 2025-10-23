/**
 * Discovery Types
 * Internal types for position discovery and enrichment
 */

import type { Address } from 'viem';

/**
 * Raw position data from on-chain
 */
export type RawPositionData = {
  tokenId: bigint;
  nonce: bigint;
  operator: Address;
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
};

/**
 * Token metadata
 */
export type TokenMetadata = {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number;
};

/**
 * Pool state
 */
export type PoolState = {
  address: Address;
  token0: Address;
  token1: Address;
  fee: number;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
};

/**
 * Enriched position (before transformation to PositionRow)
 */
export type EnrichedPosition = {
  // Basic info
  tokenId: string;
  owner: Address;
  poolAddress: Address;
  
  // Token info
  token0: TokenMetadata;
  token1: TokenMetadata;
  
  // Pool state
  fee: number;
  currentTick: number;
  sqrtPriceX96: bigint;
  
  // Position specifics
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  
  // Amounts
  amount0: bigint;
  amount1: bigint;
  
  // Fees
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  
  // Derived values
  inRange: boolean;
  lowerPrice: number;
  upperPrice: number;
  currentPrice: number;
  
  // USD values
  tvlUsd: number;
  feesUsd: number;
  
  // Rewards (from external sources)
  rflrRewards: number;
  rflrUsd: number;
  
  // Timestamps
  createdAt?: Date;
  lastUpdated: Date;
};

/**
 * Discovery options
 */
export type DiscoveryOptions = {
  includeInactive?: boolean;
  minTvlUsd?: number;
  refresh?: boolean;
};

/**
 * Discovery result
 */
export type DiscoveryResult = {
  wallet: Address;
  positions: EnrichedPosition[];
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  totalTvlUsd: number;
  totalFeesUsd: number;
  totalRewardsUsd: number;
  fetchedAt: Date;
};

