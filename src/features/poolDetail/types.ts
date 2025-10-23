export type RangeView = { 
  min: number; 
  max: number; 
  current: number; 
  inRange: boolean; 
};

export type TVLView = { 
  tvlUsd: number; 
  amount0: number; 
  amount1: number; 
  feeApr: number; 
  rflrApr?: number; 
};

export type ILView = { 
  ilPct: number; 
  hodlValueUsd: number; 
  lpValueUsd: number; 
};

export type FundingSnapshot = {
  timestamp: string; 
  price1Per0: number;
  ratioToken0: number; 
  ratioToken1: number; 
  amount0: number; 
  amount1: number; 
  usdValue: number;
};

export type RewardTotals = { 
  feesToken0: number; 
  feesToken1: number; 
  feesUsd: number; 
  rflr: number; 
  rflrUsd: number; 
  // APS removed for Phase 3
  // aps: number; 
  // apsUsd: number; 
  reinvestedUsd: number; 
  claimedUsd: number; 
  totalUsd: number;
};

export type PoolActivityMetric = {
  label: string;
  value: string;
  accent?: 'token0' | 'token1' | 'positive' | 'negative';
};

export type PoolActivityEntry = {
  id: string;
  type: 'mint' | 'transfer' | 'increase' | 'decrease' | 'collect' | 'burn';
  timestamp: string;
  txHash: string;
  title: string;
  subtitle?: string;
  metrics: PoolActivityMetric[];
};

export type PricePoint = { 
  t: string; 
  p: number; 
};

export type ValuePoint = { 
  t: string; 
  v: number; 
};

export type PoolDetailVM = {
  pairLabel: string; 
  poolId: number; 
  feeTierBps: number; 
  createdAt: string;
  poolAddress?: string;
  token0?: { symbol: string; priceUsd: number };
  token1?: { symbol: string; priceUsd: number };
  range: RangeView; 
  tvl: TVLView; 
  il: ILView; 
  rewards: RewardTotals;
  funding: FundingSnapshot;
  priceHistory: PricePoint[]; 
  tvlHistory: ValuePoint[]; 
  feesHistory: ValuePoint[]; 
  rflrHistory: ValuePoint[];
  activity: PoolActivityEntry[];
  staleSeconds: number; 
  premium: boolean;
};
