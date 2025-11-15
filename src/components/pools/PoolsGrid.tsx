'use client';

import React from 'react';

import { PoolCard } from '@/components/pools/PoolCard';
import WalletConnect from '@/components/WalletConnect';
import type { PositionData } from '@/components/PositionsTable';

const skeletonCards = Array.from({ length: 6 }, (_, idx) => idx);

type PoolsGridProps = {
  positions: PositionData[];
  isLoading?: boolean;
  walletAddress?: string;
  connectCta?: React.ReactNode;
  demoMode?: boolean;
};

export function PoolsGrid({
  positions,
  isLoading = false,
  walletAddress,
  connectCta,
  demoMode = true,
}: PoolsGridProps) {
  const hasWallet = Boolean(walletAddress);
  const hasPositions = positions.length > 0;
  const connectNode = connectCta ?? <WalletConnect />;

  if (!hasWallet && !demoMode) {
    return (
      <section className="rounded-3xl border border-white/10 bg-[rgba(11,21,48,0.88)] px-8 py-14 text-center shadow-2xl">
        <p className="font-brand text-2xl text-white">Connect your wallet to preview premium insights.</p>
        <p className="mt-3 font-ui text-sm text-white/70">We scan Ēnosys and SparkDEX automatically. Your data stays client-side.</p>
        <div className="mt-6 flex justify-center">{connectNode}</div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {skeletonCards.map((key) => (
          <div
            key={key}
            className="h-60 animate-pulse rounded-3xl border border-white/10 bg-[rgba(11,21,48,0.7)]"
          />
        ))}
      </div>
    );
  }

  if (!hasPositions && !demoMode) {
    return (
      <section className="rounded-3xl border border-dashed border-white/15 bg-[rgba(11,21,48,0.7)] px-8 py-14 text-center">
        <p className="font-brand text-2xl text-white">No pools yet</p>
        <p className="mt-3 font-ui text-sm text-white/65">Provide liquidity on Ēnosys or SparkDEX and refresh to see live RangeBand stats.</p>
        <div className="mt-6 flex justify-center">{connectNode}</div>
      </section>
    );
  }

  if (!hasPositions && demoMode) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-8 text-center font-ui text-sm text-[#B0B9C7]">
        Loading demo pools...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="hidden items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-3 text-[13px] text-white/55 sm:flex">
        <span className="font-ui">Pool</span>
        <div className="flex flex-1 items-center justify-end gap-8 font-num">
          <span>TVL (USD)</span>
          <span>24h fees</span>
          <span>Incentives</span>
          <span>Actions</span>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {positions.map((position) => (
          <PoolCard key={position.tokenId} position={position} demoMode={demoMode} />
        ))}
      </div>
    </div>
  );
}
