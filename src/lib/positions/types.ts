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
export interface PositionRow {
  /** Upstream provider slug (e.g. `enosys`, `sparkdex`). */
  provider: string;
  /** Provider specific market identifier (pool id, token id, etc.). */
  marketId: string;
  /** Optional opaque identifier used by legacy consumers (e.g. tokenId). */
  tokenId?: string;
  /** Optional provider-specific pool id (e.g. 22003). */
  poolId?: string;
  /** Pool fee tier expressed in basis points (e.g. 30 = 0.3%). */
  poolFeeBps: number;
  /** Current total value locked for this position. */
  tvlUsd: number;
  /** Outstanding/unrealised trading fees in USD. */
  unclaimedFeesUsd: number;
  /** Protocol incentives (rFLR/APS/…) accrued in USD. */
  incentivesUsd: number;
  /** Total rewards in USD (fees + incentives). */
  rewardsUsd: number;
  /** Whether the position is currently earning fees within range. */
  isInRange: boolean;
  /** Range proximity state for UI visuals. */
  status: 'in' | 'near' | 'out';
  /** Token metadata for the base asset. */
  token0: PositionTokenSide;
  /** Token metadata for the quote asset. */
  token1: PositionTokenSide;
  /** Optional APR/APY information when surfaced by the provider. */
  apr24h?: number;
  apy24h?: number;
  /** Optional high-level categorisation (Active / Inactive / Ended). */
  category?: 'Active' | 'Inactive' | 'Ended';
  /** Optional human readable DEX/venue name. */
  dexName?: string;
  /** Optional alternative display id (used in demo cards). */
  displayId?: string;
  /** Optional range data for UI visualisations. */
  rangeMin?: number;
  rangeMax?: number;
  currentPrice?: number;
  /** Optional token artwork references. */
  token0Icon?: string;
  token1Icon?: string;
  /** Optional incentive token metadata for display. */
  incentivesToken?: string;
  incentivesTokenAmount?: number;
  /** Percentage ownership of the pool (0-100). */
  liquidityShare?: number;
  /** Optional daily fee totals for APR calculations. */
  dailyFeesUsd?: number;
  dailyIncentivesUsd?: number;
  /** Flag used by demo tables. */
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
    summary: {
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
    meta: {
      address: string;
      elapsedMs: number;
      deprecation?: boolean;
    };
  };
  /** Present when `success === false`. */
  error?: string;
  /** Flag for placeholder data (e.g. degraded/deprecated endpoints). */
  placeholder?: boolean;
}
