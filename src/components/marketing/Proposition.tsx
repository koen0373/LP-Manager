'use client';

import React from 'react';

export default function Proposition() {
  return (
    <div
      className="mx-auto w-[75vw] max-w-[1200px] rounded-3xl border border-white/5 p-10 text-center backdrop-blur-xl sm:p-14"
      style={{
        background: 'rgba(10, 15, 26, 0.88)',
      }}
    >
      <h1 className="font-brand text-4xl font-semibold leading-tight text-white sm:text-5xl">
        The easy way to manage your liquidity pools.
      </h1>
      
      <p className="mt-5 font-ui text-base leading-relaxed text-[#9CA3AF] sm:text-lg">
        One clean dashboard for all your LPs — powered by live RangeBand™ insights.
      </p>

      <ul className="mt-10 space-y-4 text-left sm:text-center">
        <li className="flex items-start gap-3 font-ui text-sm text-white/90 sm:inline-flex sm:text-base">
          <span className="flex-shrink-0 text-[#1BE8D2]" aria-hidden="true">✓</span>
          <span>See every position in one view — ranges, fees, incentives, and status.</span>
        </li>
        <li className="flex items-start gap-3 font-ui text-sm text-white/90 sm:inline-flex sm:text-base">
          <span className="flex-shrink-0 text-[#1BE8D2]" aria-hidden="true">✓</span>
          <span>Make smarter moves with live RangeBand™ and actionable alerts.</span>
        </li>
        <li className="flex items-start gap-3 font-ui text-sm text-white/90 sm:inline-flex sm:text-base">
          <span className="flex-shrink-0 text-[#1BE8D2]" aria-hidden="true">✓</span>
          <span>Start free with one pool — add more anytime for <span className="tnum font-semibold">$1.99</span> per pool/month.</span>
        </li>
      </ul>
    </div>
  );
}

