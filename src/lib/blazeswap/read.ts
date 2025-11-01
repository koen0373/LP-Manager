/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Placeholder stub for "@/lib/blazeswap/read".
 * Purpose: unblock the build until the real BlazeSwap read utilities are restored.
 * Behavior: returns benign placeholder values; never throws.
 * TODO: Replace with real on-chain read implementations.
 */

export const __BLAZESWAP_READ_STUB__ = true;

// ============================================================================
// TYPE EXPORTS (used by PositionCard, RemoveLiquidityForm, dashboard)
// ============================================================================

export type PairSnapshot = {
  address: string;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  lpSymbol: string;
  lpDecimals: number;
  blockTimestampLast: number;
};

export type TokenMetadata = {
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
};

export type UserLpPosition = {
  lpBalance: string;
  shareBps: number;
  amount0: string;
  amount1: string;
};

// ============================================================================
// FUNCTION EXPORTS (used by API routes and dashboard)
// ============================================================================

// Config/utility functions
export const isBlazeSwapEnabled: any = () => false;
export const ensureRpcConfigured: any = () => {
  throw new Error('[STUB] BlazeSwap RPC not configured');
};
export const getProvider: any = () => null;

// Token metadata
export const fetchTokenMeta: any = async (..._args: any[]) => null;

// Pair data
export const readPairSnapshot: any = async (..._args: any[]): Promise<PairSnapshot | null> => null;
export const paginatePairs: any = async (..._args: any[]) => [];

// User position data
export const readUserLpPosition: any = async (..._args: any[]): Promise<UserLpPosition | null> => null;

// Generic readers (for future compatibility)
export const readPosition: any = async (..._args: any[]) => null;
export const readPositions: any = async (..._args: any[]) => [];
export const readUserPositions: any = async (..._args: any[]) => [];
export const readPair: any = async (..._args: any[]) => null;
export const readPairs: any = async (..._args: any[]) => [];
export const readPool: any = async (..._args: any[]) => null;
export const readPools: any = async (..._args: any[]) => [];
export const readPoolState: any = async (..._args: any[]) => null;
export const readIncentives: any = async (..._args: any[]) => [];
export const readFees: any = async (..._args: any[]) => null;
export const getPositionDetails: any = async (..._args: any[]) => null;
export const getPairInfo: any = async (..._args: any[]) => null;

// ============================================================================
// DEFAULT EXPORT (for default imports)
// ============================================================================

const api = {
  __BLAZESWAP_READ_STUB__,
  isBlazeSwapEnabled,
  ensureRpcConfigured,
  getProvider,
  fetchTokenMeta,
  readPairSnapshot,
  paginatePairs,
  readUserLpPosition,
  readPosition,
  readPositions,
  readUserPositions,
  readPair,
  readPairs,
  readPool,
  readPools,
  readPoolState,
  readIncentives,
  readFees,
  getPositionDetails,
  getPairInfo,
};

export default api;

