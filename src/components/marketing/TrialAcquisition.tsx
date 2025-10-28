'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';

type TrialAcquisitionProps = {
  onConnect: () => void;
};

export default function TrialAcquisition({ onConnect }: TrialAcquisitionProps) {
  return (
    <div
      className="mx-auto w-[75vw] max-w-[1200px] rounded-3xl border border-white/5 p-10 text-center backdrop-blur-xl sm:p-14"
      style={{
        background: 'rgba(10, 15, 26, 0.88)',
      }}
    >
      <h2 className="font-brand text-3xl font-semibold text-white sm:text-4xl">
        Start your free trial
      </h2>
      <p className="mt-5 font-ui text-base leading-relaxed text-[#9CA3AF] sm:text-lg">
        Connect your wallet, choose which pool to follow for free, and create your account instantly.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#1BE8D2]/20 text-2xl font-bold text-[#1BE8D2]">
            1
          </div>
          <h3 className="font-ui text-sm font-semibold uppercase tracking-wide text-white">Connect your wallet</h3>
          <p className="mt-2 font-ui text-xs text-[#B9C7DA]">
            Read-only. No approvals needed.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#1BE8D2]/20 text-2xl font-bold text-[#1BE8D2]">
            2
          </div>
          <h3 className="font-ui text-sm font-semibold uppercase tracking-wide text-white">Choose your free pool</h3>
          <p className="mt-2 font-ui text-xs text-[#B9C7DA]">
            We detect your pools automatically.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#1BE8D2]/20 text-2xl font-bold text-[#1BE8D2]">
            3
          </div>
          <h3 className="font-ui text-sm font-semibold uppercase tracking-wide text-white">Create your account</h3>
          <p className="mt-2 font-ui text-xs text-[#B9C7DA]">
            Ready in 30 seconds.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <Button
          as="button"
          onClick={onConnect}
          className="shadow-[0_0_40px_rgba(27,232,210,0.25)]"
          aria-label="Connect wallet and start trial"
        >
          Connect wallet
        </Button>
        <p className="mt-4 font-ui text-xs text-[#9CA3AF]">
          Your first pool is always free. Every additional pool is <span className="tnum font-semibold">$1.99</span> per month.
        </p>
      </div>
    </div>
  );
}

