export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address?: string;
}

export interface RawPositionData {
  nonce: number;
  operator: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: number;
  feeGrowthInside0LastX128: number;
  feeGrowthInside1LastX128: number;
  tokensOwed0: number;
  tokensOwed1: number;
}

export interface PositionRow {
  id: string;
  pairLabel: string;
  feeTierBps: number;
  tickLowerLabel: string;
  tickUpperLabel: string;
  
  // Core financial metrics
  tvlUsd: number;
  
  // Fees (unclaimed trading fees)
  unclaimedFeesUsd: number;
  dailyFeesUsd?: number;  // Alternative field name from some providers
  fee0: number;
  fee1: number;
  
  // Incentives (protocol rewards: rFLR, APS, etc.)
  incentivesUsd?: number;  // Canonical field for all incentives
  rflrRewardsUsd: number;  // rFLR-specific (legacy)
  rflrAmount: number;
  rflrUsd: number;
  rflrPriceUsd: number;
  
  // Rewards (CALCULATED server-side: fees + incentives)
  // ⚠️ This field is populated by API, never calculate manually
  rewardsUsd: number;
  
  // Category (CALCULATED server-side)
  // Active: tvlUsd > 0
  // Inactive: tvlUsd = 0 AND rewardsUsd > 0
  // Ended: tvlUsd = 0 AND rewardsUsd = 0
  // ⚠️ This field is populated by API enrichment
  category?: 'Active' | 'Inactive' | 'Ended';
  
  // Legacy status field (binary: Active/Inactive from data layer)
  status: 'Active' | 'Inactive';
  
  // Range status
  inRange: boolean;
  isInRange: boolean;
  
  // Tokens
  token0: TokenInfo;
  token1: TokenInfo;
  token0Symbol?: string;  // Alternative flat field
  token1Symbol?: string;  // Alternative flat field
  
  // Position details
  amount0: number;
  amount1: number;
  lowerPrice: number;
  upperPrice: number;
  tickLower: number;
  tickUpper: number;
  poolAddress: `0x${string}`;
  price0Usd: number;
  price1Usd: number;
  
  // Provider info
  provider?: string;
  providerSlug?: string;
  poolId?: string;
  marketId?: string;
  dexName?: string;
  displayId?: string;
  onchainId?: string; // Raw tokenId as minted on-chain
  positionManager?: `0x${string}`;
  
  // Optional metadata
  walletAddress?: string; // Wallet address that owns this position
  currentTick?: number; // Current tick of the pool
  createdAt?: string; // ISO timestamp of position creation
  lastUpdated?: string; // ISO timestamp of last update
  liquidity?: bigint; // Position liquidity
  poolLiquidity?: bigint; // Total pool liquidity
  poolSharePct?: number; // Percentage of pool owned (0-100)
}

export interface PositionState {
  positions: PositionRow[];
  loading: boolean;
  error?: string;
}
