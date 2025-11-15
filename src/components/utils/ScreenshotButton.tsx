'use client';

import React from 'react';

export default function ScreenshotButton() {
  const [busy, setBusy] = React.useState(false);

  const isBrowser = typeof window !== 'undefined';

  if (!isBrowser) return null;

  async function handleClick() {
    const isBrowser = typeof window !== 'undefined';
    if (!isBrowser) return;

    try {
      setBusy(true);
      const { toPng } = await import('html-to-image');
      const node = document.documentElement;
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: window.devicePixelRatio || 2,
        backgroundColor: '#0B0F13',
      });
      const link = document.createElement('a');
      const now = new Date();
      const pad = (value: number) => String(value).padStart(2, '0');
      const name = `liquilab-snapshot-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.png`;
      link.href = dataUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      // swallow errors to keep UX calm
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      aria-label="Download page snapshot (PNG)"
      onClick={handleClick}
      disabled={busy}
      className="btn-ghost inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-white/85 hover:border-white/25 focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1530] disabled:opacity-60"
    >
      <span role="img" aria-hidden="true">
        📷
      </span>
      {busy ? 'Saving…' : 'Download PNG'}
    </button>
  );
}
