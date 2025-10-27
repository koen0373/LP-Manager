import { useState } from 'react'

type PositionRow = {
  wallet: string
  providerSlug: string
  marketId?: string
  token0Symbol: string
  token1Symbol: string
  feeTierBps?: number
  tvlUsd?: number
  feesUsd?: number
  incentivesUsd?: number
  inRange?: boolean
  ts?: string
}

function uniqAddresses(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,;\n]+/g)
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
    )
  )
}

function shortAddr(a: string) {
  return a ? a.slice(0,6) + '…' + a.slice(-4) : ''
}

function fmtUsd(n?: number) {
  if (n == null || Number.isNaN(n)) return '-'
  try { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n) } catch { return `$${n.toFixed(2)}` }
}

async function fetchAnalytics(address: string): Promise<PositionRow[]> {
  const res = await fetch(`/api/demo/portfolio?address=${encodeURIComponent(address)}`)
  const json = await res.json()
  if (!json?.ok) return []
  const items = Array.isArray(json.positions) ? json.positions : []
  return items.map((p:any) => ({
    wallet: address,
    providerSlug: p.providerSlug,
    marketId: p.marketId,
    token0Symbol: p.token0Symbol,
    token1Symbol: p.token1Symbol,
    tvlUsd: Number(p.tvlUsd ?? 0),
    feesUsd: Number(p.feesUsd ?? 0),
    incentivesUsd: Number(p.incentivesUsd ?? 0),
    inRange: Boolean(p.inRange),
    ts: p.ts
  }))
}

/** Live fallback via existing /api/positions?address=…&refresh=1 */
async function fetchLive(address: string): Promise<PositionRow[]> {
  const url = `/api/positions?address=${encodeURIComponent(address)}&refresh=1`
  const res = await fetch(url)
  const arr = await res.json()
  if (!Array.isArray(arr)) return []
  return arr.map((p:any) => ({
    wallet: (p.walletAddress || address)?.toLowerCase(),
    providerSlug: p.providerSlug || (p.provider || '').toLowerCase().replace(/\s+/g,'-'),
    marketId: p.poolAddress || p.onchainId || p.id,
    token0Symbol: p.token0?.symbol || '',
    token1Symbol: p.token1?.symbol || '',
    feeTierBps: p.feeTierBps,
    tvlUsd: Number(p.tvlUsd ?? 0),
    feesUsd: Number(p.unclaimedFeesUsd ?? p.feesUsd ?? 0),
    incentivesUsd: Number(p.rewardsUsd ?? p.rflrRewardsUsd ?? 0),
    inRange: Boolean(p.inRange ?? p.isInRange),
    ts: new Date().toISOString()
  }))
}

export default function DemoPortfolioPage() {
  const [addressesInput, setAddressesInput] = useState<string>('')
  const [useLiveFallback, setUseLiveFallback] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(false)
  const [rows, setRows] = useState<PositionRow[]>([])
  const [error, setError] = useState<string>('')

  async function onLoad() {
    setError('')
    setRows([])
    const addrs = uniqAddresses(addressesInput)
    if (addrs.length === 0) { setError('Please paste one or more wallet addresses.'); return }
    setLoading(true)
    try {
      const perAddr = await Promise.all(
        addrs.map(a => useLiveFallback ? fetchLive(a) : fetchAnalytics(a))
      )
      setRows(perAddr.flat())
    } catch (e:any) {
      setError(e?.message || 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  const totalTVL = rows.reduce((s,r) => s + (r.tvlUsd||0), 0)
  const totalFees = rows.reduce((s,r) => s + (r.feesUsd||0), 0)
  const totalIncent = rows.reduce((s,r) => s + (r.incentivesUsd||0), 0)
  const walletsFound = new Set(rows.map(r => r.wallet)).size

  function exportCSV() {
    const header = ['wallet','provider','marketId','pair','fee_bps','tvl_usd','fees_usd','incentives_usd','in_range','timestamp']
    const lines = rows.map(r => ([
      r.wallet, r.providerSlug, r.marketId || '',
      `${r.token0Symbol}/${r.token1Symbol}`, r.feeTierBps ?? '',
      r.tvlUsd ?? '', r.feesUsd ?? '', r.incentivesUsd ?? '',
      r.inRange ? 'yes' : 'no', r.ts || ''
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')))
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `liquilab_demo_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-[#0A0F1C] text-white p-6">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-3xl font-semibold">Demo: Multi-Wallet Portfolio Viewer</h1>
        <p className="mt-2 text-[#B0B9C7]">
          Paste one or more wallet addresses (one per line, comma or space separated).
          Toggle “Live provider fallback” to query providers directly if analytics is empty.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr,220px]">
          <textarea
            value={addressesInput}
            onChange={e => setAddressesInput(e.target.value)}
            placeholder="0x57d294d815968f0efa722f1e8094da65402cd951&#10;0xabc...&#10;0xdef..."
            className="min-h-[140px] rounded-xl border border-white/10 bg-[#0F1626] p-4 font-mono text-sm outline-none focus:ring-2 focus:ring-[#6EA8FF]"
          />
          <div className="flex flex-col gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-[#B0B9C7]">
              <input
                type="checkbox"
                checked={useLiveFallback}
                onChange={e => setUseLiveFallback(e.target.checked)}
              />
              Live provider fallback (slower)
            </label>
            <button
              onClick={onLoad}
              disabled={loading}
              className="rounded-xl bg-[#6EA8FF] px-4 py-3 text-[#0A0F1C] font-semibold hover:bg-[#78B5FF] disabled:opacity-60"
            >
              {loading ? 'Loading…' : 'Load portfolio'}
            </button>
            <button
              onClick={exportCSV}
              disabled={rows.length === 0}
              className="rounded-xl border border-white/10 px-4 py-3 font-semibold hover:border-[#6EA8FF] disabled:opacity-50"
            >
              Export CSV
            </button>
          </div>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</div>}

        <div className="mt-8 rounded-2xl border border-white/10 bg-[#0F1626] p-4">
          <div className="flex flex-wrap items-center gap-6 text-sm text-[#B0B9C7]">
            <div><span className="text-white font-semibold">{walletsFound}</span> wallets</div>
            <div><span className="text-white font-semibold">{rows.length}</span> positions</div>
            <div>Total TVL: <span className="text-white font-semibold">{fmtUsd(totalTVL)}</span></div>
            <div>Unclaimed fees: <span className="text-white font-semibold">{fmtUsd(totalFees)}</span></div>
            <div>Incentives: <span className="text-white font-semibold">{fmtUsd(totalIncent)}</span></div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-[#9AA1AB] uppercase tracking-widest text-xs">
                <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
                  <th>Wallet</th>
                  <th>Provider</th>
                  <th>Pair</th>
                  <th>Fee</th>
                  <th className="text-right">TVL</th>
                  <th className="text-right">Fees</th>
                  <th className="text-right">Incentives</th>
                  <th>Status</th>
                  <th className="whitespace-nowrap">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r, i) => (
                  <tr key={i} className="[&>td]:px-3 [&>td]:py-2">
                    <td className="font-mono">{shortAddr(r.wallet)}</td>
                    <td className="uppercase text-[#B0B9C7]">{r.providerSlug}</td>
                    <td className="font-medium">{r.token0Symbol} / {r.token1Symbol}</td>
                    <td>{r.feeTierBps ? (r.feeTierBps/100).toFixed(2)+'%' : '-'}</td>
                    <td className="text-right">{fmtUsd(r.tvlUsd)}</td>
                    <td className="text-right">{fmtUsd(r.feesUsd)}</td>
                    <td className="text-right">{fmtUsd(r.incentivesUsd)}</td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{background: r.inRange ? '#00C66B' : '#E74C3C'}}></span>
                        {r.inRange ? 'In Range' : 'Out'}
                      </span>
                    </td>
                    <td className="text-[#9AA1AB]">{r.ts ? new Date(r.ts).toLocaleString() : '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-[#9AA1AB]">
                    No positions yet. Try enabling <strong>Live provider fallback</strong> or ingest analytics data.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-6 text-xs text-[#8891A0]">
          Note: Live fallback queries your configured adapters via <code>/api/positions</code> and may be slower. Analytics is preferred for investor demos.
        </p>
      </div>
    </main>
  )
}
