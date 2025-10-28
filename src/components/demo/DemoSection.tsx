'use client';

import React from 'react';
import DemoPoolsTable from './DemoPoolsTable';

export default function DemoSection() {
  return (
    <div
      aria-label="Proof of concept"
      className="mx-auto w-[75vw] max-w-[1200px] rounded-3xl border border-white/5 p-10 backdrop-blur-xl sm:p-14"
      style={{
        background: 'rgba(10, 15, 26, 0.88)',
      }}
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-brand text-3xl font-semibold text-white sm:text-4xl">
          See it live: cross-DEX pools, one dashboard
        </h2>
        <p className="mt-5 font-ui text-base leading-relaxed text-[#9CA3AF] sm:text-lg">
          Real pools from Enosys, BlazeSwap, and SparkDEX — see how LiquiLab tracks liquidity, fees, incentives, and range status.
        </p>
      </div>
      <div className="mt-10">
        <DemoPoolsTable />
      </div>
    </div>
  );
}

