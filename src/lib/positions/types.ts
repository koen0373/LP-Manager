/**
 * Canonical positions domain types shared between server and client code.
 *
 * These interfaces intentionally expose only the fields that the UI and
 * pricing flows actually rely on. Always extend these types in this file
 * (rather than re‑declaring them ad-hoc) so downstream consumers stay
 * consistent with the `/api/positions` contract.
 */

export interface PositionTokenSide {
  /** ERC20 symbol as surfaced by the upstream provider (e.g. `WFLR`). */
  symbol: string;
  /** Checksummed token address when available. */
  address: string;
  /** Optional human readable token name. */
  name?: string;
  /** ERC20 decimals – optional because some adapters do not surface it yet. */
  decimals?: number;
}

/**
 * Minimal, canonical representation of a liquidity position used across the app.
 *
 * All numeric values are expressed in **USD** unless explicitly documented.
 * Do not add presentation-only fields here – instead compute them where needed
 * (or add to the API contract deliberately).
 */
export interface PositionIncentiveToken {
  symbol: string;
  amountPerDay: string;
  tokenAddress?: string;
  decimals?: number;
}

export interface PositionClaimToken {
  symbol: string;
  amount: string;
}

export interface PositionRow {
  tokenId: string;
  dex: 'enosys-v3' | 'sparkdex-v3';
  poolAddress: string;
  pair: { symbol0: string; symbol1: string; feeBps: number };
  liquidity: string;
  amountsUsd: { total: number | null; token0: number | null; token1: number | null };
  fees24hUsd: number | null;
  incentivesUsdPerDay: number | null;
  incentivesTokens: PositionIncentiveToken[];
  status: 'in' | 'near' | 'out' | 'unknown';
  claim: { usd: number | null; tokens?: PositionClaimToken[] } | null;
  entitlements: {
    role: PositionEntitlementRole;
    flags: {
      premium: boolean;
      analytics: boolean;
    };
  };
  /** Legacy fields retained for backwards compatibility */
  provider?: string;
  marketId?: string;
  poolId?: string;
  poolFeeBps?: number;
  tvlUsd?: number;
  unclaimedFeesUsd?: number;
  incentivesUsd?: number;
  rewardsUsd?: number;
  isInRange?: boolean;
  token0?: PositionTokenSide;
  token1?: PositionTokenSide;
  apr24h?: number;
  apy24h?: number;
  category?: 'Active' | 'Inactive' | 'Ended';
  dexName?: string;
  displayId?: string;
  rangeMin?: number;
  rangeMax?: number;
  currentPrice?: number;
  token0Icon?: string;
  token1Icon?: string;
  incentivesToken?: string;
  incentivesTokenAmount?: number;
  liquidityShare?: number;
  dailyFeesUsd?: number;
  dailyIncentivesUsd?: number;
  isDemo?: boolean;
}

/**
 * Response envelope returned by the canonical `/api/positions` endpoint.
 */
export type PositionEntitlementRole = 'VISITOR' | 'PREMIUM' | 'PRO';
export type PositionEntitlementSource = 'query' | 'header' | 'cookie' | 'session';

export type PositionSummaryEntitlements = {
  role: PositionEntitlementRole;
  source: PositionEntitlementSource;
  flags: {
    premium: boolean;
    analytics: boolean;
  };
  fields?: {
    apr?: boolean;
    incentives?: boolean;
    rangeBand?: boolean;
  };
};

export interface PositionsResponse {
  success: boolean;
  data?: {
    positions: PositionRow[];
    summary?: {
      tvlUsd: number;
      fees24hUsd: number;
      incentivesUsd: number;
      rewardsUsd: number;
      count: number;
      active?: number;
      inactive?: number;
      ended?: number;
      entitlements?: PositionSummaryEntitlements;
    };
    meta?: {
      address: string;
      elapsedMs: number;
      deprecation?: boolean;
    };
    warnings?: string[];
  };
  error?: string;
  placeholder?: boolean;
}

export interface PositionsSummaryPayload {
  tvlTotalUsd: number;
  fees24hUsd: number | null;
  activeCount: number;
  entitlements: {
    role: PositionEntitlementRole;
    flags: {
      premium: boolean;
      analytics: boolean;
    };
  };
  meta?: {
    warnings?: string[];
  };
}
