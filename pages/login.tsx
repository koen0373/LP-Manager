import { useState } from 'react'
import { useRouter } from 'next/router'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) router.push('/')
    else setError('Wrong password')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0A0F1C] text-white">
      <form onSubmit={onSubmit} className="w-[92%] max-w-[380px] rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex items-center justify-center mb-4">
          <img src="/brand/liquilab-mark.svg" alt="LiquiLab" className="h-8" />
        </div>
        <h1 className="text-xl font-semibold mb-4 text-center">Preview access</h1>
        <label className="block text-sm text-white/70 mb-2">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none focus:border-[#3B82F6]"
          placeholder="Enter password"
          required
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <button type="submit" className="mt-4 w-full rounded-lg bg-[#3B82F6] text-white font-semibold py-2 transition hover:bg-[#60A5FA]">
          Enter
        </button>
      </form>
    </main>
  )
}
