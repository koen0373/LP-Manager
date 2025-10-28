'use client';

import React from 'react';
import Head from 'next/head';

import Header from '@/components/Header';
import PricingCalculator from '@/components/billing/PricingCalculator';

export default function PricingPage() {
  return (
    <>
      <Head>
        <title>LiquiLab · Pricing</title>
        <meta
          name="description"
          content="LiquiLab pricing — bundles of five pools at $1.99 per pool per month. First pool is always free and every ten paid pools unlocks a bonus slot."
        />
      </Head>
      <div className="relative min-h-screen bg-[#05070C] text-white">
        <Header showTabs={false} currentPage="pricing" />
        <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pb-24 pt-10 md:px-10">
          <PricingCalculator />
        </main>
      </div>
    </>
  );
}
