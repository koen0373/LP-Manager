'use client';

import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';

import Header from '@/components/Header';

type PaymentRow = {
  id: number;
  userId: string;
  email?: string | null;
  state: string | null;
  amountUsd: string;
  amountToken: string;
  tokenAddress: string;
  treasuryAddress: string;
  chainId: number;
  intentId: string;
  status: string;
  txHash?: string | null;
  payerAddress?: string | null;
  disclaimerAccepted: boolean;
  createdAt: string;
  expiresAt: string | null;
  approvedAt: string | null;
  invoiceNumber?: string | null;
  invoiceIssuedAt?: string | null;
  invoiceSentAt?: string | null;
  invoiceCsv?: string | null;
};

const STORAGE_KEY = 'liquilab-admin-secret';

export default function AdminPaymentsPage() {
  const [secret, setSecret] = useState('');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSecret(stored);
    }
  }, []);

  const headers = useMemo(() => {
    return secret ? { 'x-admin-secret': secret } : undefined;
  }, [secret]);

  const loadPayments = async () => {
    if (!headers) {
      setMessage('Enter the admin secret first.');
      return;
    }
    setStatus('loading');
    setMessage(undefined);

    try {
      const response = await fetch('/api/admin/payments', { headers });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Unable to fetch payments');
      }

      setPayments(data as PaymentRow[]);
      setStatus('success');
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'Unable to fetch payments';
      setMessage(errMessage);
      setStatus('error');
    }
  };

  useEffect(() => {
    if (secret) {
      localStorage.setItem(STORAGE_KEY, secret);
      loadPayments();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret]);

  const handleApprove = async (paymentId: number) => {
    if (!headers) {
      setMessage('Admin secret missing.');
      return;
    }

    try {
      const response = await fetch('/api/admin/payments/approve', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Unable to approve payment');
      }

      const messageParts = ['Payment approved and user activated.'];
      if (data.invoiceEmailSent === false) {
        messageParts.push('Invoice email pending (missing recipient).');
      } else if (data.invoiceEmailSent) {
        messageParts.push('Invoice emailed to customer.');
      }
      setMessage(messageParts.join(' '));
      loadPayments();
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'Unable to approve payment';
      setMessage(errMessage);
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', dateStyle: 'short', timeStyle: 'medium' }) + ' CET';
  };

  const handleInvoiceDownload = (payment: PaymentRow) => {
    if (!payment.invoiceCsv) return;
    const blob = new Blob([payment.invoiceCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${payment.invoiceNumber ?? `invoice-${payment.id}`}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Head>
        <title>LiquiLab · Admin Payments</title>
      </Head>
      <main className="min-h-screen bg-liqui-navy text-white font-ui">
        <Header showTabs={false} />
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
          <section className="space-y-3">
            <h1 className="font-brand text-3xl font-bold">Fast-Track Payments</h1>
            <p className="font-ui text-sm text-liqui-subtext">
              Review pending crypto payments. Mark them as approved to activate users and trigger the confirmation email.
            </p>
          </section>

          <div className="space-y-4 rounded-3xl border border-liqui-border bg-liqui-card/60 p-6">
            <label className="font-ui text-sm font-medium text-liqui-subtext" htmlFor="admin-secret">
              Admin secret
            </label>
            <input
              id="admin-secret"
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              className="font-ui w-full max-w-sm rounded-lg border border-liqui-border bg-liqui-card-hover/40 px-4 py-3 text-sm text-white outline-none focus:border-liqui-aqua"
              placeholder="Enter admin secret"
            />
            <div className="flex gap-4">
              <button
                type="button"
                onClick={loadPayments}
                className="font-ui inline-flex items-center justify-center rounded-lg bg-liqui-aqua px-4 py-2 text-sm font-semibold text-liqui-navy transition hover:bg-liqui-aqua/80"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Loading…' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSecret('');
                  setPayments([]);
                  localStorage.removeItem(STORAGE_KEY);
                }}
                className="font-ui inline-flex items-center justify-center rounded-lg border border-liqui-border px-4 py-2 text-sm font-semibold text-liqui-subtext transition hover:border-liqui-aqua hover:text-liqui-aqua"
              >
                Clear secret
              </button>
            </div>
            {message && (
              <div className="font-ui rounded-lg bg-liqui-card-hover/40 px-4 py-3 text-sm text-liqui-subtext">{message}</div>
            )}
          </div>

          <div className="overflow-x-auto rounded-3xl border border-liqui-border bg-liqui-card/60">
            <table className="min-w-full divide-y divide-liqui-border/60 text-sm font-ui">
              <thead className="bg-liqui-card-hover/40 text-liqui-subtext">
                <tr>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Tx</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Invoice</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-liqui-border/60">
                {payments.map((payment) => {
                  const createdLabel = formatDateTime(payment.createdAt) ?? '—';
                  const sentLabel = formatDateTime(payment.invoiceSentAt);
                  const issuedLabel = formatDateTime(payment.invoiceIssuedAt);

                  return (
                    <tr key={payment.id}>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-white">{payment.email ?? '—'}</span>
                          <span className="font-ui text-xs text-liqui-subtext">{payment.payerAddress ?? 'wallet unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-liqui-subtext font-ui">
                        <div className="tnum">{payment.amountToken} USDT₀</div>
                        <div className="tnum text-xs">${payment.amountUsd}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-liqui-subtext font-ui">
                        {payment.txHash ? (
                          <a
                            className="text-liqui-aqua"
                            href={`https://flare-explorer.flare.network/tx/${payment.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {payment.txHash.slice(0, 10)}…
                          </a>
                        ) : (
                          <span className="font-ui text-xs">Waiting for tx</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-liqui-subtext font-ui">
                        <div className="font-ui">{payment.status}</div>
                        <div className="text-xs">{createdLabel}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-liqui-subtext font-ui">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-white">{payment.invoiceNumber ?? '—'}</span>
                          <span className="font-ui text-xs">
                            {sentLabel
                              ? `Sent ${sentLabel}`
                              : issuedLabel
                              ? `Issued ${issuedLabel}`
                              : 'Not issued'}
                          </span>
                          {payment.invoiceCsv && (
                            <button
                              type="button"
                              onClick={() => handleInvoiceDownload(payment)}
                              className="font-ui w-fit rounded-md border border-liqui-border px-2 py-1 text-xs text-liqui-aqua transition hover:border-liqui-aqua/60 hover:bg-liqui-aqua/10"
                            >
                              Download CSV
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          disabled={payment.status !== 'PAID'}
                          onClick={() => handleApprove(payment.id)}
                          className="font-ui inline-flex items-center justify-center rounded-lg bg-liqui-aqua/10 px-4 py-2 text-xs font-semibold text-liqui-aqua transition hover:bg-liqui-aqua/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Approve
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-liqui-subtext font-ui">
                      {status === 'loading' ? 'Loading…' : 'No payments found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
