'use client';

import React from 'react';
import Head from 'next/head';
import Header from '../src/components/Header';
import { WaitlistHero } from '@/components/waitlist/WaitlistHero';
import { WaitlistForm } from '@/components/waitlist/WaitlistForm';
import { FastTrackModal } from '@/components/waitlist/FastTrackModal';

export default function LiquiLabHomepage() {
  const [fastTrackOpen, setFastTrackOpen] = React.useState(false);

  return (
    <>
      <Head>
        <title>LiquiLab · The Liquidity Pool Intelligence Platform</title>
        <meta
          name="description"
          content="LiquiLab - The Liquidity Pool Intelligence Platform. Master your liquidity on Flare Network. Get real-time insights into your LP positions."
        />
      </Head>
      <main className="pb-24">
        <Header showTabs={false} showWalletActions={false} />

        <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-6 py-12">
          <WaitlistHero onFastTrackClick={() => setFastTrackOpen(true)} />

          <section
            id="waitlist"
            className="flex flex-col gap-8 rounded-3xl border border-liqui-border bg-liqui-card/60 p-8 md:p-12"
          >
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white md:text-3xl">Join de LiquiLab wachtlijst</h2>
              <p className="text-liqui-subtext md:text-lg">
                We rollen LiquiLab gefaseerd uit. Schrijf je in voor de wachtlijst of kies fast-track om direct
                toegang te krijgen tot de pool detail beta. De eerste 50 leden ontvangen een gratis maand.
              </p>
            </div>
            <WaitlistForm />
          </section>

          <section className="grid gap-6 rounded-3xl border border-liqui-border bg-liqui-card/60 p-8 md:grid-cols-3 md:p-10">
            <FeatureCard
              title="Realtime FLARE data"
              description="Live prijsrange, fee accrual en pool health. Gebouwd op viem + Prisma voor snelle refreshes."
            />
            <FeatureCard
              title="Community first"
              description="De beta wordt samen met de eerste 50 gebruikers vormgegeven. Deel feedback en zie het terug."
            />
            <FeatureCard
              title="Wallet-native toegang"
              description="Betaal via USDT of WFLR om je plek in de rij te versnellen. Geen accounts, alleen je wallet."
            />
          </section>
        </div>

        <FastTrackModal open={fastTrackOpen} onClose={() => setFastTrackOpen(false)} />
      </main>
    </>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
}

function FeatureCard({ title, description }: FeatureCardProps) {
  return (
    <div className="rounded-2xl border border-liqui-border bg-liqui-card-hover/50 p-6">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-liqui-subtext">{description}</p>
    </div>
  );
}
