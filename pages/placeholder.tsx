import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import React from 'react';

import { LiquiLabLogoLockup } from '@/components/LiquiLabLogo';

const problemStatements = [
  'Tracking pools across multiple DEXs means switching between fragmented dashboards.',
  'Maintaining Excel sheets to calculate real APY and track performance over time.',
  'Managing liquidity pools should be simple — not a maze of complexity.',
];

interface FormState {
  status: 'idle' | 'submitting' | 'success' | 'error';
  message?: string;
}

export default function PlaceholderPage() {
  const [email, setEmail] = React.useState('');
  const [state, setState] = React.useState<FormState>({ status: 'idle' });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      setState({ status: 'error', message: 'Enter your email address.' });
      return;
    }

    setState({ status: 'submitting' });

    try {
      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Unable to register. Please try again.');
      }

      setState({ status: 'success', message: 'Thank you. We will share product updates soon.' });
      setEmail('');
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unable to register. Please try again.',
      });
    }
  };

  return (
    <>
      <Head>
        <title>LiquiLab — The Liquidity Pool Intelligence Platform</title>
        <meta
          name="description"
          content="LiquiLab — The easy way to manage your liquidity pools. Get calm clarity, track performance, and receive product updates." />
      </Head>
      <div className="relative min-h-screen bg-[#0A0F1C] hero-wave-bg bg-top bg-no-repeat bg-cover text-white">
        {/* Fallback: inline style `style={{ backgroundImage: \"url('/media/hero-wave.svg')\" }}` if Tailwind purges this utility. */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#0A0F1C]/60 via-[#0A0F1C]/40 to-[#0A0F1C]/85" />
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-8 md:px-10">
          <LiquiLabLogoLockup size="md" theme="dark" />
          <Link
            href="/login"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6EA8FF]"
          >
            Login
          </Link>
        </header>

        <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 pb-24 pt-8 md:px-10">
          {/* Problem Statement - Visual Proof */}
          <section className="rounded-2xl border border-white/10 bg-[rgba(10,15,26,0.65)] px-6 py-8 backdrop-blur-lg">
            <div className="space-y-4">
              <h2 className="font-brand text-xl font-semibold text-white md:text-2xl">
                Managing liquidity pools today
              </h2>
              <p className="font-ui text-base leading-relaxed text-[#9FA8B6]">
                Fragmented interfaces. Scattered data. Manual Excel tracking. This is what most LPs deal with every day.
              </p>
            </div>
            
            {/* Screenshot of complex provider interfaces */}
            <div className="mt-6 overflow-hidden rounded-xl border border-white/15 bg-transparent">
              <Image
                src="/media/providers.png"
                alt="Providers"
                width={1216}
                height={684}
                priority
                className="h-auto w-full rounded-xl object-cover"
                sizes="(min-width: 1024px) 1216px, 100vw"
              />
            </div>
            
            <p className="mt-4 font-ui text-sm leading-relaxed text-[#748199] italic">
              Current liquidity pool interfaces scatter critical information across multiple tabs, requiring LPs to juggle between platforms and manual spreadsheets.
            </p>
          </section>

          {/* Solution & CTA */}
          <section className="rounded-3xl border border-white/10 bg-[rgba(10,15,26,0.7)] px-8 py-12 backdrop-blur-xl md:px-14 md:py-16">
            <div className="space-y-6">
              <p className="font-brand text-sm uppercase tracking-[0.3em] text-[#6EA8FF]/80">The Liquidity Pool Intelligence Platform</p>
              <h1 className="font-brand text-4xl font-semibold text-white md:text-5xl">
                The easy way to manage your liquidity pools.
              </h1>
              <p className="font-ui text-lg leading-relaxed text-[#B0B9C7] md:text-xl">
                One clear dashboard for all your liquidity pools — across Enosys, BlazeSwap, and SparkDEX. Track performance, fees, and range status in real time, without the chaos.
              </p>
            </div>

            <div className="mt-8 rounded-xl border border-white/5 bg-white/[0.02] px-6 py-6">
              <p className="mb-4 font-ui text-xs font-semibold uppercase tracking-wider text-[#6EA8FF]/70">Why LPs Choose LiquiLab</p>
              <ul className="space-y-3 text-[#B0B9C7]">
                {problemStatements.map((statement) => (
                  <li key={statement} className="flex items-start gap-3 font-ui text-base leading-relaxed">
                    <span className="mt-1.5 inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#6EA8FF]" aria-hidden="true" />
                    {statement}
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={handleSubmit} className="mt-12 flex flex-col gap-3 font-ui md:flex-row">
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-[#748199] focus:border-[#6EA8FF] focus:outline-none focus:ring-2 focus:ring-[#6EA8FF]/40"
                autoComplete="email"
                required
              />
              <button
                type="submit"
                disabled={state.status === 'submitting'}
                className="inline-flex items-center justify-center rounded-xl bg-[#6EA8FF] px-5 py-3 text-base font-semibold text-[#0A0F1C] transition hover:shadow-[0_0_24px_rgba(110,168,255,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6EA8FF] disabled:cursor-wait disabled:opacity-60"
              >
                {state.status === 'submitting' ? 'Sending…' : 'Notify me'}
              </button>
            </form>
            <p className="mt-3 font-ui text-sm text-[#748199]">
              Early access notifications only. No spam, ever.
            </p>

            {state.status === 'error' && state.message ? (
              <p className="mt-4 font-ui text-sm text-[#FF8A8A]">{state.message}</p>
            ) : null}
            {state.status === 'success' && state.message ? (
              <p className="mt-4 font-ui text-sm text-[#6EA8FF]">{state.message}</p>
            ) : null}
          </section>
        </main>
      </div>
    </>
  );
}
