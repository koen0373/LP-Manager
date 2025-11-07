'use client';
import { useState } from 'react';

export default function Placeholder() {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/placeholder/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const j = await r.json();
      if (j.ok) {
        window.location.href = '/';
      } else {
        setErr(j.reason || 'Login failed');
      }
    } catch (e:any) {
      setErr(e?.message || 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-[#0B1530] text-white">
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-lg" style={{background:'#0B1530', border:'1px solid rgba(255,255,255,0.06)'}}>
        <h1 className="text-xl mb-2">LiquiLab</h1>
        <p className="opacity-80 mb-6">Private preview • enter password to continue</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-xl px-3 py-2 text-black"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl px-3 py-2 font-medium"
            style={{background:'#2D6AE3'}}
          >
            {busy ? 'Checking…' : 'Enter'}
          </button>
          {err && <p className="text-red-300 text-sm">{err}</p>}
        </form>
        <p className="text-xs mt-6 opacity-60">© {new Date().getFullYear()} LiquiLab — noindex</p>
      </div>
    </main>
  );
}
