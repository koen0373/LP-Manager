import * as React from 'react'

export default function Placeholder() {
  const [pwd, setPwd] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string|undefined>()

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(undefined)
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      })
      if (!r.ok) throw new Error('Login failed')
      location.href = '/'
    } catch (e:any) {
      setErr('Incorrect password'); setBusy(false)
    }
  }

  return (
    <main className="min-h-screen relative text-white">
      {/* Brand background */}
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <div className="w-full h-full"
          style={{
            backgroundColor: '#0A0F1C',
            backgroundImage: 'url(/media/wave-hero.png)',
            backgroundPosition: 'bottom',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover'
          }}
        />
      </div>

      {/* Header met login rechtsboven */}
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <img src="/brand/liquilab-mark.svg" alt="LiquiLab" className="h-7 w-auto" />
          <span className="font-semibold tracking-tight text-[18px]">LiquiLab</span>
        </div>
        <form onSubmit={doLogin} className="flex items-center gap-2">
          <input
            type="password"
            placeholder="Enter access password"
            className="rounded-md bg-white/10 border border-white/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6EA8FF]"
            value={pwd}
            onChange={e=>setPwd(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-[#6EA8FF] text-[#0A0F1C] px-4 py-2 text-sm font-semibold hover:bg-[#78B5FF] disabled:opacity-60"
            aria-label="Login to preview"
          >
            {busy ? 'Signing in…' : 'Login'}
          </button>
        </form>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-24 md:py-36">
        <img src="/brand/liquilab-mark.svg" alt="" className="h-16 w-auto opacity-90 mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Coming soon</h1>
        <p className="mt-2 text-sm text-[#9AA1AB]">Have an access password? Use the login in the top-right.</p>
        {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
      </section>
    </main>
  )
}
