import React from 'react';

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

export function WaitlistForm() {
  const [email, setEmail] = React.useState('');
  const [wallet, setWallet] = React.useState('');
  const [state, setState] = React.useState<SubmitState>('idle');
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('loading');
    setError(null);

    try {
      const response = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, wallet }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Unknown error');
      }

      setState('success');
      setEmail('');
      setWallet('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to join waitlist');
      setState('error');
    }
  };

  const isSubmitting = state === 'loading';

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-liqui-subtext" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-liqui-border bg-liqui-card px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-liqui-aqua"
          placeholder="you@domain.com"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-liqui-subtext" htmlFor="wallet">
          Wallet (optional)
        </label>
        <input
          id="wallet"
          type="text"
          value={wallet}
          onChange={(event) => setWallet(event.target.value)}
          className="w-full rounded-lg border border-liqui-border bg-liqui-card px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-liqui-aqua"
          placeholder="0x..."
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {state === 'success' && (
        <p className="text-sm text-liqui-aqua">Thanks! We will email you with early-access updates soon.</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-liqui-aqua px-4 py-3 text-sm font-semibold text-liqui-navy transition hover:bg-liqui-aqua/80 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? 'Submitting…' : 'Join the waitlist'}
      </button>
    </form>
  );
}
