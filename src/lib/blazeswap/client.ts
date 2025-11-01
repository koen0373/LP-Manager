/* eslint-disable @typescript-eslint/no-explicit-any */
/* istanbul ignore file */

/**
 * Placeholder stub for "@/lib/blazeswap/client".
 * Purpose: unblock build until real client utils are restored.
 * Behavior: returns benign placeholders; never throws.
 * TODO: Replace with real client (RPC/Provider) wiring.
 */

export const __BLAZESWAP_CLIENT_STUB__ = true;

// ============================================================================
// CONSTANTS (used by components and lib files)
// ============================================================================

export const BLAZESWAP_ROUTER_ADDRESS = '0x0000000000000000000000000000000000000000';

// ============================================================================
// TYPE PLACEHOLDERS
// ============================================================================

export type BlazeClientConfig = any;
export type RpcConfig = any;

// ============================================================================
// FEATURE FLAGS / READINESS
// ============================================================================

export const isBlazeSwapEnabled: any = () => false;
export const ensureRpcConfigured: any = async (_cfg?: RpcConfig) => ({ ok: true });

// ============================================================================
// PROVIDER / CLIENT GETTERS
// ============================================================================

export const getProvider: any = (_chainId?: number) => ({
  chainId: _chainId ?? 14,
  request: async () => null,
});

export const getPublicClient: any = (_cfg?: BlazeClientConfig) => ({
  config: _cfg ?? null,
  request: async () => null,
});

export const getWalletClient: any = (_cfg?: BlazeClientConfig) => ({
  config: _cfg ?? null,
  request: async () => null,
});

export const createClient: any = (_cfg?: BlazeClientConfig) => ({
  config: _cfg ?? null,
  request: async () => null,
});

export const getBrowserProvider: any = () => null;

// ============================================================================
// SIGNER (used by RemoveLiquidityForm)
// ============================================================================

export const getSigner: any = async (..._args: any[]) => null;

// ============================================================================
// CONTRACT HELPERS (used by lib/blazeswap/write.ts)
// ============================================================================

export const getErc20Contract: any = (_address: string) => ({
  address: _address,
  approve: async () => ({ hash: '0x0' }),
  allowance: async () => 0n,
});

export const getRouterContract: any = (_address?: string) => ({
  address: _address ?? BLAZESWAP_ROUTER_ADDRESS,
  addLiquidity: async () => ({ hash: '0x0' }),
  removeLiquidity: async () => ({ hash: '0x0' }),
});

// ============================================================================
// ALLOWANCE CHECKER (used by PositionCard)
// ============================================================================

export const getAllowance: any = async (
  _tokenAddress: string,
  _owner: string,
  _spender: string,
) => 0n;

// ============================================================================
// UTILITIES
// ============================================================================

export const getChainId: any = async () => 14;
export const toHex: any = (v: any) =>
  typeof v === 'number' ? '0x' + v.toString(16) : String(v ?? '0x0');
export const fromHex: any = (v: any) => v;

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

const api = {
  __BLAZESWAP_CLIENT_STUB__,
  BLAZESWAP_ROUTER_ADDRESS,
  isBlazeSwapEnabled,
  ensureRpcConfigured,
  getProvider,
  getPublicClient,
  getWalletClient,
  createClient,
  getBrowserProvider,
  getSigner,
  getErc20Contract,
  getRouterContract,
  getAllowance,
  getChainId,
  toHex,
  fromHex,
};

export default api;

