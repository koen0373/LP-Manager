export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address?: string;
}

export interface PositionData {
  nonce: bigint;
  operator: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

export interface PositionRow {
  id: string;
  pairLabel: string;
  feeTierBps: number;
  tickLowerLabel: string;
  tickUpperLabel: string;
  tvlUsd: number;
  rewardsUsd: number;
  rflrAmount: number;
  rflrUsd: number;
  rflrPriceUsd: number;
  inRange: boolean;
  status: 'Active' | 'Inactive';
  token0: TokenInfo;
  token1: TokenInfo;
  // New fields for detailed data
  amount0: bigint;
  amount1: bigint;
  lowerPrice: number;
  upperPrice: number;
  isInRange: boolean;
  poolAddress: `0x${string}`;
}

export interface PositionData {
  positions: PositionRow[];
  loading: boolean;
  error?: string;
}