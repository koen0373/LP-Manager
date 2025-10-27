import React from 'react';

interface FastTrackModalProps {
  open: boolean;
  onClose: () => void;
}

export function FastTrackModal({ open, onClose }: FastTrackModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl border border-liqui-border bg-liqui-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="font-brand text-xl font-semibold text-white">Fast-track access</h2>
          <button
            type="button"
            onClick={onClose}
            className="font-ui rounded-full bg-liqui-card-hover px-2 py-1 text-sm text-liqui-subtext hover:text-white"
          >
            ✕
          </button>
        </div>
        <p className="font-ui mt-4 text-sm text-liqui-subtext">
          Send 10&nbsp;USDT to the LiquiLab treasury address and email us your transaction hash. We’ll place you
          at the front of the queue and activate your Pool Detail beta access as soon as it’s ready.
        </p>

        <div className="mt-6 space-y-3 rounded-xl border border-liqui-border bg-liqui-card-hover/50 p-4 font-ui text-sm text-liqui-subtext">
          <div>
            <span className="font-brand font-semibold text-white">USDT (Flare)</span>
            <p>0x1234...ABCD (example address – replace with treasury)</p>
          </div>
          <div>
            <span className="font-brand font-semibold text-white">Amount</span>
            <p>10 USDT</p>
          </div>
          <div>
            <span className="font-brand font-semibold text-white">Email</span>
            <p>support@liquilab.io</p>
          </div>
        </div>

        <p className="font-ui mt-4 text-xs text-liqui-subtext/80">
          Tip: use the same wallet as in the form so we can match your request quickly. Refunds (if declined) are
          processed within 72 hours.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="font-ui mt-6 w-full rounded-lg bg-liqui-aqua px-4 py-3 text-sm font-semibold text-liqui-navy transition hover:bg-liqui-aqua/80"
        >
          Got it – back to the form
        </button>
      </div>
    </div>
  );
}
