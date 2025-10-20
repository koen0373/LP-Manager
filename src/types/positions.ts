export type TokenInfo = {
  symbol: string;
  address?: string;
  iconUrl?: string;
};

export type PositionRow = {
  id: number | string;
  pairLabel: string;
  feeTierBps: number;
  tickLowerLabel: string;
  tickUpperLabel: string;
  tvlUsd: number;
  rewardsUsd: number;
  rflrAmount?: number;
  rflrUsd?: number;
  rflrPriceUsd?: number;
  inRange: boolean;
  status: 'Active' | 'Closed';
  token0: TokenInfo;
  token1: TokenInfo;
};
