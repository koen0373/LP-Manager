import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';

type ApiResp = {
  ok: boolean;
  tables?: string[];
  table?: string;
  total?: number;
  limit?: number;
  offset?: number;
  q?: string;
  columns?: string[];
  rows?: any[];
  lastUpdatedIso?: string;
  reason?: string;
};

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', dateStyle: 'short', timeStyle: 'medium' }) + ' CET';
}

function toCsv(columns: string[], rows: any[]) {
  const esc = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return `"${s.replace(/"/g,'""')}"`;
  };
  const head = columns.map(esc).join(',');
  const body = rows.map(r => columns.map(c => esc(r[c])).join(',')).join('\n');
  return head + '\n' + body;
}

export default function AdminDb() {
  const [tables, setTables] = useState<string[]>([]);
  const [table, setTable] = useState<string>('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [last, setLast] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|undefined>();

  // initial load: fetch tables
  useEffect(() => {
    (async () => {
      const r = await fetch('/api/admin/db');
      const j: ApiResp = await r.json();
      setTables(j.tables || []);
      if (j.tables && j.tables.length && !table) {
        setTable(j.tables[0]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    if (!table) return;
    setLoading(true); setError(undefined);
    try {
      const params = new URLSearchParams({ table, limit: String(limit), offset: String(offset) });
      if (q) params.set('q', q);
      const r = await fetch('/api/admin/db?' + params.toString());
      const j: ApiResp = await r.json();
      if (!j.ok) throw new Error(j.reason || 'request failed');
      setColumns(j.columns || []);
      setRows(j.rows || []);
      setTotal(j.total || 0);
      setLast(j.lastUpdatedIso || '');
    } catch (e:any) {
      setError(e?.message || 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [table, limit, offset]);

  const page = Math.floor(offset / Math.max(1, limit)) + 1;
  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));

  const csvHref = useMemo(() => {
    if (!columns.length || !rows.length) return undefined;
    const blob = new Blob([toCsv(columns, rows)], { type: 'text/csv;charset=utf-8;' });
    return URL.createObjectURL(blob);
  }, [columns, rows]);

  return (
    <main className="min-h-screen text-white" style={{ background:'#0B1530', fontFamily:'ui-sans-serif, system-ui, -apple-system, Inter, Segoe UI, Roboto'}}>
      <Head><title>LiquiLab — Admin / Database</title></Head>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Admin — Database</h1>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end mb-4">
          <div className="md:col-span-2">
            <label className="text-sm opacity-80">Table</label>
            <select
              className="w-full rounded-xl px-3 py-2 text-black"
              value={table}
              onChange={(e)=>{ setTable(e.target.value); setOffset(0); }}
            >
              {tables.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm opacity-80">Search</label>
            <div className="flex gap-2">
              <input className="flex-1 rounded-xl px-3 py-2 text-black"
                     placeholder="text query (ILIKE over text columns)"
                     value={q} onChange={(e)=>setQ(e.target.value)} />
              <button className="rounded-xl px-3 py-2" style={{background:'#2D6AE3'}} onClick={()=>{ setOffset(0); load(); }}>
                Search
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm opacity-80">Rows / page</label>
            <select className="w-full rounded-xl px-3 py-2 text-black" value={limit} onChange={(e)=>{ setLimit(Number(e.target.value)); setOffset(0); }}>
              {[25,50,100,200].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <button className="rounded-xl px-3 py-2" disabled={page<=1 || loading}
                    onClick={()=> setOffset(Math.max(0, offset - limit))}
                    style={{ background:'#22315e', opacity: page<=1?0.5:1 }}>Prev</button>
            <button className="rounded-xl px-3 py-2" disabled={page>=pages || loading}
                    onClick={()=> setOffset(offset + limit)}
                    style={{ background:'#22315e', opacity: page>=pages?0.5:1 }}>Next</button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between text-sm opacity-80 mb-2">
          <div>
            {loading ? 'Loading…' : error ? <span style={{color:'#ff9aa2'}}>Error: {error}</span> :
              <>Showing <b>{rows.length}</b> of <b>{total}</b> rows — page <b>{page}</b> / {pages}</>}
          </div>
          <div style={{fontVariantNumeric:'tabular-nums'}}>Last updated: {fmtDate(last)}</div>
        </div>

        {/* Table */}
        <div className="overflow-auto rounded-xl border border-white/10 bg-white/5">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                {columns.map(c => <th key={c} className="text-left px-3 py-2 border-b border-white/10">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="odd:bg-white/0 even:bg-white/5">
                  {columns.map(c => (
                    <td key={c} className="px-3 py-2 align-top">
                      <code className="text-[12px]">{typeof r[c] === 'object' ? JSON.stringify(r[c]) : String(r[c] ?? '')}</code>
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td className="px-3 py-6 opacity-70" colSpan={columns.length || 1}>No rows</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Export */}
        <div className="mt-3 flex gap-3">
          {csvHref && (
            <a href={csvHref} download={`${table || 'data'}.csv`} className="rounded-xl px-3 py-2" style={{background:'#2D6AE3'}}>Download CSV</a>
          )}
          <a href="/admin/ankr" className="rounded-xl px-3 py-2" style={{background:'#22315e'}}>← Back to ANKR</a>
        </div>
      </div>
    </main>
  );
}
