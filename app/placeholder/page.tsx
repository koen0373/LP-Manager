'use client';
import { useEffect, useState } from 'react';

const BG = '#0B1530';
const PRIMARY = '#2D6AE3';
const ACCENT = '#33E0E0';

export default function Placeholder() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => { document.title = 'LiquiLab — Private Preview'; }, []);

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!password) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/placeholder/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const j = await r.json();
      if (j.ok) { setOk(true); setTimeout(()=>{ window.location.href='/' }, 600); }
      else setErr(j.reason || 'Invalid password');
    } catch (e:any) { setErr(e?.message || 'Network error'); }
    finally { setBusy(false); }
  }

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center"
      style={{
        backgroundColor: BG,
        backgroundImage: 'url(/media/wave-hero.svg), radial-gradient(1200px 600px at 70% -10%, rgba(51,224,224,0.07), transparent 60%)',
        backgroundRepeat: 'no-repeat, no-repeat',
        backgroundSize: 'cover, 100% 100%',
        backgroundPosition: 'top center, center',
        color: 'white',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Helvetica, Arial',
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl"
        style={{ background:'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(8px)' }}
      >
        <div className="p-7 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div aria-hidden style={{ width:28, height:28, borderRadius:8, background:ACCENT, boxShadow:'0 0 0 6px rgba(51,224,224,0.15)' }}/>
            <h1 className="text-2xl font-semibold tracking-tight">LiquiLab</h1>
          </div>
          <p className="text-sm opacity-80 mb-6"><span style={{ color: ACCENT }}>Private preview</span> — enter password to continue.</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-sm opacity-90 mb-1" htmlFor="password">Access password</label>
            <div className="flex items-stretch gap-2">
              <input id="password" type="password" autoFocus placeholder="••••••••"
                className="flex-1 rounded-xl px-3 py-2 text-black outline-none"
                value={password} onChange={(e)=>setPassword(e.target.value)} required />
              <button type="submit" disabled={busy || !password}
                className="rounded-xl px-4 py-2 font-medium transition-colors"
                style={{ background: PRIMARY, opacity: busy || !password ? 0.8 : 1, boxShadow:'0 8px 30px rgba(45,106,227,0.35)' }}>
                {busy ? 'Checking…' : 'Enter'}
              </button>
            </div>
            {err && <p className="text-sm mt-1" style={{ color:'#ff9aa2' }}>{err}</p>}
            {ok && <p className="text-sm mt-1" style={{ color: ACCENT }}>Access granted — redirecting…</p>}
          </form>
          <div className="mt-8 flex items-center justify-between text-xs opacity-70">
            <span>© {new Date().getFullYear()} LiquiLab — noindex</span>
            <span style={{ fontVariantNumeric:'tabular-nums' }}>Build: {process.env.NEXT_PUBLIC_COMMIT?.slice(0,7) || 'local'}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
