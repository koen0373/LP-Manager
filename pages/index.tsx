import { useState } from "react";
import Head from "next/head";
import Link from "next/link";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PoolsTable, { type PoolsTableItem } from "@/components/pools/PoolsTable";
import { RangeBand } from "@/components/pools/PoolRangeIndicator";
import PremiumCard from "@/components/pricing/PremiumCard";

const HERO = {
  eyebrow: "Built for FLR Liquidity Providers",
  heading: "All your liquidity pools, in one clear dashboard.",
  subheading:
    "See every position across Flare, track fees in real-time, and spot pool health instantly — without moving your assets.",
};

const POOLS_SAMPLE: PoolsTableItem[] = [
  {
    provider: "enosys-v3",
    token0: { symbol: "WFLR", address: "0x0001" },
    token1: { symbol: "USDT₀", address: "0x0002" },
    tvlUsd: 482_520,
    unclaimedFeesUsd: 1293.42,
    incentivesUsd: 540.1,
    incentivesToken: "WFLR",
    incentivesTokenAmount: 120.4,
    apr24h: 18.5,
    isInRange: true,
    status: "in",
    range: { min: 0.00021, max: 0.00028, current: 0.00024 },
    tokenId: "13241",
    poolAddress: "0xpool1",
    marketId: "0xpool1",
    poolFeeBps: 30,
    amount0: 1204.42,
    amount1: 1320.55,
    fee0: 12.4,
    fee1: 11.2,
    liquidityShare: 0.94,
  },
  {
    provider: "sparkdex-v3",
    token0: { symbol: "FXRP", address: "0x0003" },
    token1: { symbol: "USDC.e", address: "0x0004" },
    tvlUsd: 289_150,
    unclaimedFeesUsd: 845.76,
    incentivesUsd: 0,
    incentivesToken: null,
    incentivesTokenAmount: null,
    apr24h: 22.1,
    isInRange: false,
    status: "near",
    range: { min: 0.98, max: 1.03, current: 0.975 },
    tokenId: "9982",
    poolAddress: "0xpool2",
    marketId: "0xpool2",
    poolFeeBps: 5,
    amount0: 980.1,
    amount1: 1023.8,
    fee0: 6.2,
    fee1: 7.1,
    liquidityShare: 0.42,
  },
  {
    provider: "enosys-v3",
    token0: { symbol: "JOULE", address: "0x0005" },
    token1: { symbol: "USDT₀", address: "0x0006" },
    tvlUsd: 64_980,
    unclaimedFeesUsd: 192.31,
    incentivesUsd: 86.45,
    incentivesToken: "JOULE",
    incentivesTokenAmount: 220.12,
    apr24h: 9.3,
    isInRange: true,
    status: "in",
    range: { min: 2.1, max: 2.6, current: 2.22 },
    tokenId: "22114",
    poolAddress: "0xpool3",
    marketId: "0xpool3",
    poolFeeBps: 10,
    amount0: 412.2,
    amount1: 202.4,
    fee0: 1.2,
    fee1: 0.8,
    liquidityShare: 0.73,
  },
];

const RANGE_SAMPLE = {
  min: 0.00021,
  max: 0.00028,
  current: 0.00024,
  status: "in" as const,
  token0Symbol: "FXRP",
  token1Symbol: "USD₮0",
};

export default function HomePage() {
  return (
    <>
      <Head>
        <title>LiquiLab · Clarity for your Flare liquidity</title>
        <meta
          name="description"
          content="Monitor every Flare liquidity position in one dashboard. RangeBand™ health, real-time fees, and optional alerts."
        />
      </Head>
      <div className="relative min-h-screen overflow-hidden text-white">
        <div className="page-bg" aria-hidden="true" />
        <Header currentPage="home" />

        <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-20 sm:px-8 md:gap-14 md:py-24">
          <HeroSection />
          <PoolsTableSection />
          <RangeBandCard />
          <section className="flex justify-center">
            <PremiumCard showExtras />
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}

function HeroSection() {
  return (
    <section className="card space-y-6 text-center">
      <p className="font-ui text-xs uppercase tracking-[0.3em] text-white/60">{HERO.eyebrow}</p>
      <h1 className="font-brand text-4xl font-semibold text-white sm:text-5xl">{HERO.heading}</h1>
      <p className="mx-auto max-w-3xl font-ui text-base text-white/75">{HERO.subheading}</p>
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a href="/pricing#trial" className="btn-primary">
          Start free trial
        </a>
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center radius-ctrl bg-white/10 px-5 py-3 font-ui text-sm font-semibold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1530]"
        >
          See pricing
        </Link>
      </div>
    </section>
  );
}

function PoolsTableSection() {
  return (
    <section className="card space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-brand text-2xl font-semibold text-white">Your pools at a glance</h2>
          <p className="font-ui text-xs text-white/55">Expand by default — collapse (+) to hide RangeBand™ details.</p>
        </div>
      </div>
      <PoolsTable
      title="POOLS TABLE"
      items={POOLS_SAMPLE}
      entitlements={{ role: "FREE", fields: { apr: true, incentives: true, rangeBand: true } }}
      defaultExpanded={false}
    />
  </section>
  );
}

function RangeBandCard() {
  const [variant, setVariant] = useState<"stacked" | "inline">("stacked");

  return (
    <section className="card space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="font-brand text-2xl font-semibold text-white">Interactive Explainer</h2>
          <p className="max-w-lg font-ui text-sm text-white/70">
            Switch display mode and preview how RangeBand™ reflects pool health.
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Toggle RangeBand display mode">
          <button
            type="button"
            className={variant === "stacked" ? "btn-primary" : "segmented-btn--off"}
            aria-pressed={variant === "stacked"}
            onClick={() => setVariant("stacked")}
          >
            +
          </button>
          <button
            type="button"
            className={variant === "inline" ? "btn-primary" : "segmented-btn--off"}
            aria-pressed={variant === "inline"}
            onClick={() => setVariant("inline")}
          >
            −
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        <RangeBand
          min={RANGE_SAMPLE.min}
          max={RANGE_SAMPLE.max}
          current={RANGE_SAMPLE.current}
          status={RANGE_SAMPLE.status}
          token0Symbol={RANGE_SAMPLE.token0Symbol}
          token1Symbol={RANGE_SAMPLE.token1Symbol}
          explainer
          variant={variant}
        />
      </div>

      <p className="text-center font-ui text-sm text-white/60">
        Range: <span className="font-num text-white">{RANGE_SAMPLE.min.toFixed(5)}</span> —
        <span className="font-num text-white"> {RANGE_SAMPLE.max.toFixed(5)}</span> · Current
        <span className="font-num text-white"> {RANGE_SAMPLE.current.toFixed(5)}</span>
      </p>
    </section>
  );
}
