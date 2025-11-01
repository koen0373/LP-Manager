import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/Header';

export default function PartnersPage() {
  return (
    <>
      <Head>
        <title>Partner with LiquiLab</title>
        <meta
          name="description"
          content="Embed RangeBand™ in your DEX or portfolio tool. Flexible licensing: flat chain fee, per-viewer, or revenue share."
        />
      </Head>

      <div className="relative min-h-screen overflow-hidden text-white">
        <div className="page-bg" aria-hidden="true" />
        
        <Header 
          currentPage={undefined} 
          showTabs={false}
          showWalletActions={false}
        />

        <div className="relative z-10 mx-auto w-[94vw] max-w-[800px] px-4 pb-20 pt-12 lg:px-8">
          {/* Hero Section */}
          <section className="mb-16 text-center">
            <h1 className="font-brand text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              Partner with LiquiLab
            </h1>
            <p className="mx-auto mt-6 max-w-2xl font-ui text-base leading-relaxed text-white/75 sm:text-lg">
              Embed RangeBand™ in your DEX, aggregator, or portfolio tool to help LPs instantly understand their position health. 
              We offer flexible licensing tailored to your platform&rsquo;s scale and business model.
            </p>
          </section>

          {/* Main Content Card */}
          <section className="mb-12">
            <div className="glass-card rounded-3xl p-8 sm:p-12">
              {/* Licensing Options */}
              <h2 className="mb-6 font-brand text-2xl font-semibold text-white">
                RangeBand™ Licensing at a glance
              </h2>
              
              <ul className="mb-10 space-y-4 font-ui text-base leading-relaxed text-white/80">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#6EA8FF]/20 font-brand text-sm font-semibold text-[#6EA8FF]">
                    1
                  </span>
                  <div>
                    <strong className="text-white">Flat chain license</strong> — Predictable monthly fee + impression tier. 
                    Best for high-volume platforms with stable traffic.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#6EA8FF]/20 font-brand text-sm font-semibold text-[#6EA8FF]">
                    2
                  </span>
                  <div>
                    <strong className="text-white">Per active LP viewer</strong> — Pay per unique LP who sees RangeBand™. 
                    Scales naturally with your user base.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#6EA8FF]/20 font-brand text-sm font-semibold text-[#6EA8FF]">
                    3
                  </span>
                  <div>
                    <strong className="text-white">Revenue share</strong> — Percentage of first-year net subscription from tracked referrals. 
                    Ideal for platforms driving LP engagement.
                  </div>
                </li>
              </ul>

              {/* Key Terms */}
              <div className="space-y-6 border-t border-white/10 pt-8">
                <div>
                  <h3 className="mb-2 font-brand text-lg font-semibold text-white">
                    Pilot Program
                  </h3>
                  <p className="font-ui text-sm leading-relaxed text-white/70">
                    90-day pilot with KPI review. Platform fee waived during pilot phase.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 font-brand text-lg font-semibold text-white">
                    Service Level
                  </h3>
                  <p className="font-ui text-sm leading-relaxed text-white/70">
                    99.5% uptime target • Cached p95 &lt; 1.2s • Graceful fallbacks for edge cases.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 font-brand text-lg font-semibold text-white">
                    Intellectual Property
                  </h3>
                  <p className="font-ui text-sm leading-relaxed text-white/70">
                    RangeBand™ patent pending. Attribution required: &ldquo;Powered by RangeBand™&rdquo; (text only, no logo).
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="text-center">
            <p className="mb-6 font-ui text-base text-white/70">
              Ready to integrate RangeBand™ into your platform?
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-lg bg-[#6EA8FF] px-8 py-3 font-brand text-base font-semibold text-white transition-all duration-200 hover:bg-[#5A96E6] hover:shadow-[0_0_20px_rgba(110,168,255,0.3)] focus:outline-none focus:ring-2 focus:ring-[#6EA8FF]/50"
              >
                Contact Us
              </Link>
              <a
                href="mailto:support@liquilab.io"
                className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/[0.04] px-8 py-3 font-brand text-base font-semibold text-white transition-all duration-200 hover:border-[#6EA8FF] hover:bg-[#6EA8FF]/10 focus:outline-none focus:ring-2 focus:ring-[#6EA8FF]/50"
              >
                support@liquilab.io
              </a>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
