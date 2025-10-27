'use client';

import { useState } from 'react';

import Head from 'next/head';

import Header from '@/components/Header';

interface FormState {
  email: string;
  wallet: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
}

const initialState: FormState = {
  email: '',
  wallet: '',
  status: 'idle',
};

export default function WaitlistPage() {
  const [state, setState] = useState<FormState>(initialState);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!state.email && !state.wallet) {
      setState((prev) => ({ ...prev, status: 'error', message: 'Provide an email or wallet address so we can reserve your spot.' }));
      return;
    }

    setState((prev) => ({ ...prev, status: 'loading', message: undefined }));

    try {
      const response = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.email, wallet: state.wallet }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to join waitlist');
      }

      setState((prev) => ({ ...prev, status: 'success', message: 'You\'re on the waitlist. We\'ll email you as soon as we have updates.' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update the waitlist.';
      setState((prev) => ({ ...prev, status: 'error', message }));
    }
  };

  return (
    <>
      <Head>
        <title>LiquiLab · Waitlist</title>
        <meta name="description" content="Join the LiquiLab waitlist for early access" />
      </Head>
      <main className="min-h-screen bg-liqui-navy text-white font-ui">
        <Header showTabs={false} />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12">
          <section className="space-y-4">
            <h1 className="font-brand text-3xl font-bold md:text-4xl">Join the LiquiLab Waitlist</h1>
            <p className="font-ui text-liqui-subtext md:text-lg">
              Sign up for early access. Early operators get two pools free and hear first when the Pool Detail beta unlocks.
            </p>
          </section>

          <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-liqui-border bg-liqui-card/60 p-8">
            <div className="space-y-1">
              <label htmlFor="email" className="font-ui text-sm font-medium text-liqui-subtext">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required={!state.wallet}
                value={state.email}
                onChange={(event) => setState((prev) => ({ ...prev, email: event.target.value }))}
                className="font-ui w-full rounded-lg border border-liqui-border bg-liqui-card-hover/40 px-4 py-3 text-sm text-white outline-none focus:border-liqui-aqua"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="wallet" className="font-ui text-sm font-medium text-liqui-subtext">
                Wallet address (optional)
              </label>
              <input
                id="wallet"
                type="text"
                value={state.wallet}
                onChange={(event) => setState((prev) => ({ ...prev, wallet: event.target.value }))}
                className="font-ui w-full rounded-lg border border-liqui-border bg-liqui-card-hover/40 px-4 py-3 text-sm text-white outline-none focus:border-liqui-aqua"
                placeholder="0x..."
              />
            </div>

            <button
              type="submit"
              disabled={state.status === 'loading'}
              className="font-ui inline-flex w-full items-center justify-center rounded-xl bg-liqui-aqua px-4 py-3 text-sm font-semibold text-liqui-navy transition hover:bg-liqui-aqua/80 disabled:cursor-wait disabled:opacity-70"
            >
              {state.status === 'loading' ? 'Submitting…' : 'Join the waitlist'}
            </button>

            {state.message && (
              <div
                className={`font-ui rounded-lg px-4 py-3 text-sm ${
                  state.status === 'success' ? 'bg-liqui-aqua/10 text-liqui-aqua' : 'bg-red-500/10 text-red-200'
                }`}
              >
                {state.message}
              </div>
            )}

            <div className="space-y-1 text-xs text-liqui-subtext font-ui">
              <p className="font-brand font-semibold uppercase tracking-wide text-[10px] text-liqui-aqua">Disclaimer</p>
              <p>
                LiquiLab is in early development. Outages or data issues may occur. No refunds can be issued for early
                access or usage-based fees.
              </p>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
