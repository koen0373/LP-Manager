export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address?: string;
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
}

export interface PositionData {
  positions: PositionRow[];
  loading: boolean;
  error?: string;
}