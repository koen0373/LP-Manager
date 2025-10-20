export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address?: string;
}

export interface PositionData {
  nonce: string;
  operator: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  feeGrowthInside0LastX128: string;
  feeGrowthInside1LastX128: string;
  tokensOwed0: string;
  tokensOwed1: string;
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
  amount0: string;
  amount1: string;
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