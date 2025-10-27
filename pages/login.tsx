import Head from 'next/head';
import { useRouter } from 'next/router';
import React from 'react';

import { LiquiLabLogoLockup } from '@/components/LiquiLabLogo';

interface FormState {
  status: 'idle' | 'submitting' | 'success' | 'error';
  message?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState('');
  const [state, setState] = React.useState<FormState>({ status: 'idle' });

  const nextPath = typeof router.query.next === 'string' ? router.query.next : '/';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) {
      setState({ status: 'error', message: 'Enter the preview password.' });
      return;
    }

    setState({ status: 'submitting' });

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Incorrect password');
      }

      setPassword('');
      setState({ status: 'success' });
      router.replace(nextPath);
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unable to verify password.',
      });
    }
  };

  return (
    <>
      <Head>
        <title>LiquiLab — Preview Login</title>
      </Head>
      <div className="relative min-h-screen bg-[#0A0F1C] hero-wave-bg bg-top bg-no-repeat bg-cover text-white">
        {/* Fallback: inline style `style={{ backgroundImage: "url('/media/hero-wave.svg')" }}` if Tailwind purges this utility. */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#0A0F1C]/60 via-[#0A0F1C]/40 to-[#0A0F1C]/85" />

        <div className="relative flex min-h-screen flex-col items-center justify-center px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[rgba(10,15,26,0.88)] px-8 py-10 backdrop-blur-lg">
            <div className="flex justify-center">
              <LiquiLabLogoLockup size="sm" theme="dark" />
            </div>
            <h1 className="mt-8 text-center font-brand text-2xl font-semibold text-white">
              Enter the preview password
            </h1>
            <p className="mt-3 text-center font-ui text-sm text-[#9FA8B6]">
              LiquiLab is currently accessible to the core team and early operators.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4 font-ui">
              <label htmlFor="password" className="text-sm font-medium text-[#B0B9C7]">
                Preview password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-[#748199] focus:border-[#6EA8FF] focus:outline-none focus:ring-2 focus:ring-[#6EA8FF]/40"
                autoComplete="current-password"
                required
              />
              <button
                type="submit"
                disabled={state.status === 'submitting'}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#6EA8FF] px-4 py-3 text-sm font-semibold text-[#0A0F1C] transition hover:shadow-[0_0_24px_rgba(110,168,255,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6EA8FF] disabled:cursor-wait disabled:opacity-60"
              >
                {state.status === 'submitting' ? 'Verifying…' : 'Unlock preview'}
              </button>
            </form>

            {state.status === 'error' && state.message ? (
              <p className="mt-4 text-center font-ui text-sm text-[#FF8A8A]">{state.message}</p>
            ) : null}
            {state.status === 'success' ? (
              <p className="mt-4 text-center font-ui text-sm text-[#6EA8FF]">
                Access granted. Redirecting to LiquiLab…
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
