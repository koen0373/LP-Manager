import React from 'react';

export default function AddLiquidityForm() {
  return (
    <div
      className="rounded-xl border border-white/10 bg-white/[0.06] p-4 text-white/80"
      role="group"
      aria-label="BlazeSwap Add Liquidity (placeholder)"
    >
      <h3 className="font-brand text-lg text-white">BlazeSwap — Add Liquidity</h3>
      <p className="mt-2 font-ui text-sm">
        This module is temporarily unavailable while we finalize integration. Your app remains fully functional —
        core pages and the new sales offer flow are unaffected.
      </p>
      <p className="mt-2 font-ui text-xs text-white/60">
        Note: This placeholder removes a build-time dependency on internal BlazeSwap read utilities.
      </p>
    </div>
  );
}
