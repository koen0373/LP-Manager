'use client';

import { useState } from 'react';
import Head from 'next/head';

import Header from '@/components/Header';

type IntentResponse = {
  intentId: string;
  treasury: string;
  token: string;
  amountToken: string;
  amountUsd: string;
  chainId: number;
  expiresAt: string | null;
};

const fastTrackDisclaimer = 'LiquiLab is in early development. Outages or data issues may occur. No refunds can be issued for early access or usage-based payments.';

function buildQrContent(intent: IntentResponse) {
  return `Send ${intent.amountToken} USDT0 to ${intent.treasury} on Flare (chainId ${intent.chainId}). Intent: ${intent.intentId}`;
}

export default function FastForwardPayPage() {
  const [intent, setIntent] = useState<IntentResponse | null>(null);
  const [email, setEmail] = useState('');
  const [wallet, setWallet] = useState('');
  const [txHash, setTxHash] = useState('');
  const [fromWallet, setFromWallet] = useState('');
  const [status, setStatus] = useState<'idle' | 'creating' | 'awaiting' | 'confirming' | 'paid' | 'error'>('idle');
  const [message, setMessage] = useState<string | undefined>();

  const handleCreateIntent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('creating');
    setMessage(undefined);

    try {
      const response = await fetch('/api/fastforward/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, wallet }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create payment intent');
      }

      const data = (await response.json()) as IntentResponse;
      setIntent(data);
      setStatus('awaiting');
      setFromWallet(wallet);
      setMessage('Send the payment from your wallet, then paste the transaction hash.');
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'Unable to create payment intent.';
      setStatus('error');
      setMessage(errMessage);
    }
  };

  const handleConfirmPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!intent) return;
    if (!txHash.trim()) {
      setMessage('Transaction hash is required.');
      return;
    }

    setStatus('confirming');
    setMessage(undefined);

    try {
      const response = await fetch('/api/fastforward/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: intent.intentId,
          txHash: txHash.trim(),
          fromWallet: fromWallet.trim() || wallet.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Confirmation failed.');
      }

      setStatus('paid');
      setMessage('Payment detected, pending admin approval.');
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'Unable to confirm payment.';
      setStatus('error');
      setMessage(errMessage);
    }
  };

  return (
    <>
      <Head>
        <title>LiquiLab · Fast-Track Payment</title>
      </Head>
      <main className="min-h-screen bg-liqui-navy text-white">
        <Header showTabs={false} />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12">
          <section className="space-y-4">
            <h1 className="font-brand text-3xl font-bold md:text-4xl">Fast-Track · $50 in USDT₀</h1>
            <p className="text-liqui-subtext md:text-lg">
              Send a one-time $50 payment in USDT₀ (Flare) to the LiquiLab treasury. After on-chain confirmation an admin approves your access and unlocks two pools.
            </p>
          </section>

          {!intent && (
            <form onSubmit={handleCreateIntent} className="space-y-6 rounded-3xl border border-liqui-border bg-liqui-card/60 p-8">
              <div className="space-y-1">
                <label htmlFor="email" className="text-sm font-medium text-liqui-subtext">
                  Email address (for updates)
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="w-full rounded-lg border border-liqui-border bg-liqui-card-hover/40 px-4 py-3 text-sm text-white outline-none focus:border-liqui-aqua"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="wallet" className="text-sm font-medium text-liqui-subtext">
                  Wallet address (Flare)
                </label>
                <input
                  id="wallet"
                  type="text"
                  value={wallet}
                  onChange={(event) => setWallet(event.target.value)}
                  required
                  className="w-full rounded-lg border border-liqui-border bg-liqui-card-hover/40 px-4 py-3 text-sm text-white outline-none focus:border-liqui-aqua"
                  placeholder="0x..."
                />
              </div>

              <button
                type="submit"
                disabled={status === 'creating'}
                className="inline-flex w-full items-center justify-center rounded-xl bg-liqui-aqua px-4 py-3 text-sm font-semibold text-liqui-navy transition hover:bg-liqui-aqua/80 disabled:cursor-wait disabled:opacity-70"
              >
                {status === 'creating' ? 'Creating…' : 'Generate payment instructions'}
              </button>

              <div className="space-y-1 text-xs text-liqui-subtext">
                <p className="font-semibold uppercase tracking-wide text-[10px] text-liqui-aqua">Disclaimer</p>
                <p>{fastTrackDisclaimer}</p>
              </div>

              {message && (
                <div className={`rounded-lg px-4 py-3 text-sm ${status === 'error' ? 'bg-red-500/10 text-red-200' : 'bg-liqui-aqua/10 text-liqui-aqua'}`}>
                  {message}
                </div>
              )}
            </form>
          )}

          {intent && (
            <section className="space-y-6 rounded-3xl border border-liqui-border bg-liqui-card/60 p-8">
              <header className="space-y-2">
                <h2 className="text-2xl font-semibold">1. Send 50 USDT₀ to the LiquiLab treasury</h2>
                <p className="text-sm text-liqui-subtext">
                  Use USDT₀ (6 decimals) on Flare (chainId {intent.chainId}). Intent ID: {intent.intentId}
                </p>
              </header>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-liqui-subtext">Treasury address</p>
                    <code className="mt-1 block rounded-lg bg-liqui-card-hover/40 p-3 text-sm text-liqui-aqua">
                      {intent.treasury}
                    </code>
                  </div>
                  <div className="flex gap-3 text-sm text-liqui-subtext">
                    <span className="rounded-lg border border-liqui-border px-3 py-2">Token: USDT₀</span>
                    <span className="rounded-lg border border-liqui-border px-3 py-2">Amount: {intent.amountToken}</span>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(buildQrContent(intent))}`}
                    alt="QR code to pay fast-track"
                    className="h-40 w-40 rounded-lg border border-liqui-border bg-white p-2"
                  />
                </div>
              </div>

              <form onSubmit={handleConfirmPayment} className="space-y-4">
                <header className="space-y-2">
                  <h2 className="text-2xl font-semibold">2. Confirm your payment</h2>
                  <p className="text-sm text-liqui-subtext">
                    Paste the transaction hash so we can match the payment. After a short review your account is activated manually.
                  </p>
                </header>

                <div className="space-y-1">
                  <label htmlFor="txHash" className="text-sm font-medium text-liqui-subtext">
                    Transaction hash
                  </label>
                  <input
                    id="txHash"
                    type="text"
                    value={txHash}
                    onChange={(event) => setTxHash(event.target.value)}
                    required
                    className="w-full rounded-lg border border-liqui-border bg-liqui-card-hover/40 px-4 py-3 text-sm text-white outline-none focus:border-liqui-aqua"
                    placeholder="0x..."
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="fromWallet" className="text-sm font-medium text-liqui-subtext">
                    Paying wallet (optional)
                  </label>
                  <input
                    id="fromWallet"
                    type="text"
                    value={fromWallet}
                    onChange={(event) => setFromWallet(event.target.value)}
                    className="w-full rounded-lg border border-liqui-border bg-liqui-card-hover/40 px-4 py-3 text-sm text-white outline-none focus:border-liqui-aqua"
                    placeholder="0x..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === 'confirming' || status === 'paid'}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-liqui-aqua px-4 py-3 text-sm font-semibold text-liqui-navy transition hover:bg-liqui-aqua/80 disabled:cursor-wait disabled:opacity-70"
                >
                  {status === 'confirming' ? 'Verifying…' : 'Confirm payment'}
                </button>

                {message && (
                  <div className={`rounded-lg px-4 py-3 text-sm ${status === 'error' ? 'bg-red-500/10 text-red-200' : 'bg-liqui-aqua/10 text-liqui-aqua'}`}>
                    {message}
                  </div>
                )}

                {status === 'paid' && (
                  <p className="text-sm text-liqui-subtext">
                    Payment detected, pending admin approval. You will receive an email once access is activated.
                  </p>
                )}
              </form>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
