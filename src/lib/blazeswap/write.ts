/* eslint-disable @typescript-eslint/no-explicit-any */
/* istanbul ignore file */

/**
 * Placeholder stub for "@/lib/blazeswap/write".
 * Purpose: unblock build until real write helpers are restored.
 * Behavior: returns benign placeholders; never throws.
 * TODO: Replace with actual tx builders/senders (add/remove liquidity, approvals, etc).
 */

export const __BLAZESWAP_WRITE_STUB__ = true;

// ============================================================================
// TYPE PLACEHOLDERS
// ============================================================================

const emptyHash = '0x0000000000000000000000000000000000000000000000000000000000000000';

export type TxRequest = any;
export type TxResult = { hash: string; ok: boolean; reason?: string } | null;

// ============================================================================
// APPROVAL / ALLOWANCE HELPERS
// ============================================================================

export const approveIfNeeded: any = async (..._args: any[]) => ({
  approved: true,
  hash: emptyHash,
});

export const ensureAllowance: any = async (..._args: any[]) => ({ ok: true });

export const estimateGas: any = async (..._args: any[]) => 0n;

// ============================================================================
// TX BUILDER / SIMULATOR / SENDER PATTERN
// ============================================================================

export const buildTx: any = async (..._args: any[]) => ({
  to: '0x0',
  data: '0x',
  value: 0n,
});

export const simulate: any = async (..._args: any[]) => ({ ok: true });

export const submit: any = async (..._args: any[]) =>
  ({ hash: emptyHash, ok: true } as TxResult);

export const sendTx: any = async (..._args: any[]) =>
  ({ hash: emptyHash, ok: true } as TxResult);

// ============================================================================
// LIQUIDITY OPERATIONS (used by RemoveLiquidityForm and other components)
// ============================================================================

export const addLiquidity: any = async (..._args: any[]) => ({
  hash: emptyHash,
  ok: true,
});

export const removeLiquidity: any = async (..._args: any[]) => ({
  hash: emptyHash,
  ok: true,
});

export const increaseLiquidity: any = async (..._args: any[]) => ({
  hash: emptyHash,
  ok: true,
});

export const decreaseLiquidity: any = async (..._args: any[]) => ({
  hash: emptyHash,
  ok: true,
});

// ============================================================================
// CLAIM OPERATIONS
// ============================================================================

export const claimFees: any = async (..._args: any[]) => ({
  hash: emptyHash,
  ok: true,
});

export const claimRewards: any = async (..._args: any[]) => ({
  hash: emptyHash,
  ok: true,
});

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

const api = {
  __BLAZESWAP_WRITE_STUB__,
  approveIfNeeded,
  ensureAllowance,
  estimateGas,
  buildTx,
  simulate,
  submit,
  sendTx,
  addLiquidity,
  removeLiquidity,
  increaseLiquidity,
  decreaseLiquidity,
  claimFees,
  claimRewards,
};

export default api;

