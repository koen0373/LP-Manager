'use client';

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

import Header from '../src/components/Header';
import { DemoPoolsPreview } from '@/components/waitlist/DemoPoolsPreview';
import { PricingPanel } from '@/components/marketing/PricingPanel';

export default function LiquiLabHomepage() {
  // Smooth scroll helper
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <Head>
        <title>LiquiLab · The Liquidity Pool Intelligence Platform</title>
        <meta
          name="description"
          content="The easy way to manage your liquidity pools. Built by LPs, for LPs — LiquiLab brings clarity, control, and confidence to liquidity pool management."
        />
      </Head>

      {/* Global styles for containers */}
      <style jsx global>{`
        /* Water background - always visible */
        .page-bg {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: #0A0F1C;
          z-index: 0;
        }

        .page-bg::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 100%; /* Full page background */
          background-color: #0A0F1C;
          background-image: url('/wave-hero.png');
          background-size: cover; /* Fill the entire space */
          background-position: center bottom;
          background-repeat: no-repeat;
          z-index: 0;
        }

        .page-bg::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            to bottom,
            #0A0F1A 0%,
            rgba(10, 15, 26, 0.7) 30%, /* Gentle fade from top */
            transparent 50%
          );
          z-index: 1;
        }

        /* Glass overlay blocks */
        .glass-block {
          background: rgba(10, 15, 26, 0.88);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
        }

        /* Container widths - responsive */
        .hero-container,
        .demo-pools-container,
        .pricing-container {
          max-width: 94vw;
          margin: 0 auto;
        }

        @media (min-width: 1024px) {
          .hero-container,
          .demo-pools-container,
          .pricing-container {
            max-width: 88vw;
          }
        }

        @media (min-width: 1280px) {
          .hero-container,
          .demo-pools-container,
          .pricing-container {
            max-width: 75vw;
          }
        }

        @media (min-width: 1600px) {
          .hero-container,
          .demo-pools-container,
          .pricing-container {
            max-width: 70vw;
          }
        }

        /* Pricing card spacing */
        .pricing-card-content {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 8px;
          padding: 24px 20px;
          min-height: 460px;
        }

        .price-line {
          line-height: 1.2;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }
      `}</style>

      {/* Fixed water background */}
      <div className="page-bg" />

      <main className="relative min-h-screen">
        {/* Header */}
        <Header showTabs={false} />

        {/* 1️⃣ HERO SECTION — Promise */}
        <section className="relative py-20 md:py-32">
          <div className="hero-container px-6">
            <div className="glass-block mx-auto max-w-[720px] px-8 py-12 text-center md:px-12 md:py-16">
              {/* Headline */}
              <h1 className="font-brand text-4xl font-bold leading-tight tracking-[0.01em] text-white md:text-5xl lg:text-6xl">
                The easy way to manage your liquidity pools
              </h1>

              {/* Subheadline */}
              <p className="mt-6 font-ui text-lg leading-relaxed text-[#B0B9C7] md:text-xl">
                Built by LPs, for LPs — LiquiLab brings clarity, control, and confidence to liquidity pool management.
              </p>

              {/* CTAs */}
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => scrollToSection('proof')}
                  className="inline-flex items-center justify-center rounded-xl bg-[#6EA8FF] px-6 py-3.5 text-base font-semibold text-[#0A0F1C] transition-all duration-200 hover:bg-[#78B5FF] hover:shadow-[0_0_16px_rgba(110,168,255,0.3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-liqui-aqua/50"
                >
                  Explore live demo pools
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('subscription')}
                  className="inline-flex items-center justify-center rounded-xl border border-liqui-aqua/30 px-6 py-3.5 text-base font-semibold text-liqui-aqua transition-all duration-200 hover:border-liqui-aqua/50 hover:bg-liqui-aqua/6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-liqui-aqua/50"
                >
                  Choose your Liquidity Journey
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 2️⃣ PROBLEM SECTION */}
        <section className="relative py-20 md:py-28">
          <div className="hero-container px-6">
            <div className="glass-block px-8 py-12 md:px-12 md:py-16">
              {/* Heading */}
              <h2 className="font-brand text-center text-3xl font-semibold text-white md:text-4xl">
                Managing liquidity pools should be simple — but it isn’t.
              </h2>

              {/* Problem statements */}
              <div className="mt-12 grid gap-8 md:grid-cols-3">
                {/* Problem 1 */}
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-liqui-aqua/20 bg-liqui-aqua/10">
                    <svg
                      className="h-8 w-8 text-liqui-aqua"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <p className="font-ui text-base leading-[1.4] text-[#B0B9C7]">
                    LPs juggle multiple positions, incentives, and price ranges across different DEXs.
                  </p>
                </div>

                {/* Problem 2 */}
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-liqui-aqua/20 bg-liqui-aqua/10">
                    <svg
                      className="h-8 w-8 text-liqui-aqua"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="font-ui text-base leading-[1.4] text-[#B0B9C7]">
                    Tracking fees and rewards takes time — and clarity gets lost in the noise.
                  </p>
                </div>

                {/* Problem 3 */}
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-liqui-aqua/20 bg-liqui-aqua/10">
                    <svg
                      className="h-8 w-8 text-liqui-aqua"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                      />
                    </svg>
                  </div>
                  <p className="font-ui text-base leading-[1.4] text-[#B0B9C7]">
                    LiquiLab simplifies this complexity with clear, real-time insight into every pool you own.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3️⃣ PROOF SECTION — Demo Pools */}
        <section id="proof" className="scroll-mt-20 relative py-20 md:py-28">
          <div className="demo-pools-container px-6">
            <div className="glass-block px-8 py-12 md:px-12 md:py-16">
              {/* Heading */}
              <div className="mb-12 text-center">
                <h2 className="font-brand text-3xl font-semibold text-white md:text-4xl">
                  One clear dashboard for all your liquidity pools.
                </h2>
                <div className="mt-6 space-y-3 font-ui text-lg leading-[1.4] text-[#B0B9C7]">
                  <p>
                    LiquiLab connects to your wallet and brings together all your LP positions — across Enosys,
                    BlazeSwap, and SparkDEX — into a single, elegant view.
                  </p>
                  <p>
                    Track performance, incentives, and range status in real time.
                  </p>
                  <p>
                    Explore how LiquiLab visualizes your pools. These live demo pools show exactly how the platform
                    tracks liquidity, fees, incentives, and range health across multiple DEXs.
                  </p>
                </div>
              </div>

              {/* Demo pools table - inherits glass from parent */}
              <div className="overflow-hidden rounded-lg border border-white/5">
                <DemoPoolsPreview />
              </div>

              {/* CTA after table */}
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={() => scrollToSection('subscription')}
                  className="inline-flex items-center justify-center rounded-xl bg-[#6EA8FF] px-6 py-3 text-base font-semibold text-[#0A0F1C] transition-all duration-200 hover:bg-[#78B5FF] hover:shadow-[0_0_12px_rgba(110,168,255,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-liqui-aqua/50"
                >
                  Try the demo yourself
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 5️⃣ SUBSCRIPTION SECTION */}
        <section id="subscription" className="scroll-mt-20 relative py-20 md:py-28">
          <div className="pricing-container px-6">
            <PricingPanel />
          </div>
        </section>

        {/* Footer */}
        <footer className="relative border-t border-white/5 py-12">
          <div className="pricing-container px-6">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="text-center md:text-left">
                <p className="font-brand text-lg font-semibold text-white">LiquiLab</p>
                <p className="mt-1 font-ui text-sm text-[#8891A0]">The Liquidity Pool Intelligence Platform</p>
              </div>
              <div className="flex gap-8">
                <Link href="/docs" className="font-ui text-sm text-[#B0B9C7] transition-colors hover:text-white">
                  Docs
                </Link>
                <Link href="/faq" className="font-ui text-sm text-[#B0B9C7] transition-colors hover:text-white">
                  FAQ
                </Link>
                <Link
                  href="/contact"
                  className="font-ui text-sm text-[#B0B9C7] transition-colors hover:text-white"
                >
                  Contact
                </Link>
              </div>
            </div>
            <div className="mt-8 border-t border-white/5 pt-6 text-center">
              <p className="font-ui text-xs text-[#8891A0]">© 2025 LiquiLab. Built by LPs, for LPs.</p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
