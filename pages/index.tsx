'use client';

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

import Header from '@/components/Header';
import PricingCalculator from '@/components/billing/PricingCalculator';
import { DemoPoolsPreview } from '@/components/waitlist/DemoPoolsPreview';

export default function LiquiLabHomepage() {
  return (
    <>
      <Head>
        <title>LiquiLab · The Liquidity Pool Intelligence Platform</title>
        <meta
          name="description"
          content="LiquiLab makes it effortless to monitor, price, and expand your liquidity pool strategy. First pool is free — upgrade in bundles as you grow."
        />
      </Head>

      <div className="relative min-h-screen bg-[#05070C] text-white">
        <Header showTabs={false} currentPage="home" />

        <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 pb-24 pt-12 md:px-10">
          {/* Hero */}
          <section className="rounded-3xl border border-white/10 bg-[rgba(10,15,26,0.85)] px-8 py-14 text-center backdrop-blur-2xl md:px-16">
            <div className="flex flex-col items-center gap-6">
              <span className="font-brand text-xs uppercase tracking-[0.32em] text-[#6EA8FF]/80">Built by LPs, for LPs</span>
              <h1 className="max-w-3xl font-brand text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
                The easy way to manage your liquidity pools
              </h1>
              <p className="max-w-2xl font-ui text-lg leading-relaxed text-[#B0B9C7] md:text-xl">
                LiquiLab unifies pricing, performance, and capacity planning across Enosys, BlazeSwap, and SparkDEX. Connect your wallet, claim your free pool, and grow in predictable bundles.
              </p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-xl bg-[#6EA8FF] px-6 py-3 text-base font-semibold text-[#0A0F1C] transition hover:bg-[#78B5FF] hover:shadow-[0_0_20px_rgba(110,168,255,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6EA8FF]"
                >
                  Launch dashboard
                </Link>
                <Link
                  href="#pricing"
                  className="inline-flex items-center justify-center rounded-xl border border-white/20 px-6 py-3 text-base font-semibold text-white/80 transition hover:border-white hover:text-white"
                >
                  View pricing
                </Link>
              </div>
            </div>
          </section>

          {/* Product pillars */}
          <section className="grid gap-6 md:grid-cols-3" id="proof">
            {[
              {
                title: 'Real pool intelligence',
                copy: 'Detect active, inactive, and drifting positions across ecosystems with one refresh.',
              },
              {
                title: 'Capacity you can trust',
                copy: 'First pool is free. Paid bundles add five pools at a time with bonus slots on every ten.',
              },
              {
                title: 'Frictionless onboarding',
                copy: 'Connect MetaMask, Rabby, Bifrost, or Xaman. Pick your free pool and upgrade from the same screen.',
              },
            ].map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-white/10 bg-[rgba(10,15,26,0.7)] px-6 py-6 backdrop-blur-xl"
              >
                <h2 className="font-brand text-xl font-semibold text-white">{card.title}</h2>
                <p className="mt-3 font-ui text-sm text-[#B0B9C7]">{card.copy}</p>
              </article>
            ))}
          </section>

          {/* Live demo section */}
          <section className="rounded-3xl border border-white/10 bg-[rgba(10,15,26,0.75)] px-6 py-10 backdrop-blur-xl md:px-10">
            <h2 className="font-brand text-2xl font-semibold text-white md:text-3xl">See live LP data before you connect</h2>
            <p className="mt-3 font-ui text-sm text-[#B0B9C7]">
              Nine real pools across Enosys, BlazeSwap, and SparkDEX. Compare TVL, unclaimed fees, incentives, and APY with the exact UI you get after connecting.
            </p>
            <div className="mt-8">
              <DemoPoolsPreview />
            </div>
          </section>

          {/* Pricing calculator */}
          <section id="pricing">
            <PricingCalculator />
          </section>
        </main>
      </div>
    </>
  );
}
