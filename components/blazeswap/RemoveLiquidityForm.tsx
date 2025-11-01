'use client';

import * as React from 'react';

/**
 * Placeholder for RemoveLiquidityForm.
 * Purpose: unblock build until ethers v5/v6 migration is complete.
 * TODO: Restore full remove liquidity functionality with correct BigNumber handling.
 */

type RemoveLiquidityFormProps = {
  account?: string | null;
  pairAddress: string;
  pairDecimals: number;
  token0: { address: string; symbol: string; decimals: number };
  token1: { address: string; symbol: string; decimals: number };
  position?: { lpBalance: string; shareBps: number; amount0: string; amount1: string } | null;
  onSubmitted?: () => void;
};

export function RemoveLiquidityForm({
  account,
  token0,
  token1,
}: RemoveLiquidityFormProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <header>
        <h3 className="font-brand text-lg font-semibold text-white">
          Remove liquidity
        </h3>
        <p className="font-ui text-xs text-white/50">
          BlazeSwap liquidity removal is temporarily unavailable.
        </p>
      </header>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="font-ui text-sm text-amber-200">
          {token0.symbol}/{token1.symbol} liquidity removal coming soon.
        </p>
        {!account && (
          <p className="mt-2 font-ui text-xs text-white/60">
            Connect your wallet to manage liquidity.
          </p>
        )}
      </div>

      <p className="text-center font-ui text-xs text-white/40">
        This feature is under development. Your LP tokens remain safe in your wallet.
      </p>
    </div>
  );
}
