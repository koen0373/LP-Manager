import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const conn = process.env.DATABASE_URL;
if (!conn) { console.error('❌ No DATABASE_URL in env'); process.exit(1); }

const root = process.cwd();
const rawDir = path.join(root, 'data', 'raw');
const posPath = path.join(root, 'data', 'enriched', 'positions.json');

const client = new Client({
  connectionString: conn,
  ssl: /\/\/(localhost|127\.0\.0\.1)/.test(conn) ? undefined : { rejectUnauthorized: false },
});

const ensureTables = async () => {
  await client.query(`
    create table if not exists public.ingested_erc721_raw(
      contract text,
      event text,
      tx_hash text,
      log_index integer,
      block_number bigint,
      ts timestamptz,
      raw jsonb,
      primary key (tx_hash, log_index)
    )`);
  await client.query(`
    create table if not exists public.ingested_positions(
      token_id text primary key,
      owner text,
      pool text,
      tick_lower integer,
      tick_upper integer,
      liquidity numeric,
      tokens_owed0 numeric,
      tokens_owed1 numeric,
      last_event_block bigint,
      data jsonb
    )`);
};

const low = v => v == null ? null : String(v).toLowerCase();
const num = v => (v==null ? null : (Number.isFinite(+v) ? +v : null));
const toDate = v => {
  if (v == null) return null;
  if (typeof v === 'number') return new Date(v * 1000);
  const n = Number(v); if (Number.isFinite(n)) return new Date(n);
  const d = new Date(v); return isNaN(+d) ? null : d;
};

const importRaw = async () => {
  if (!fs.existsSync(rawDir)) { console.warn(`# ℹ️  ${rawDir} bestaat niet`); return 0; }
  const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.ndjson') && (f.startsWith('erc721_') || f.startsWith('nfpm_')));
  if (!files.length) { console.warn('# ℹ️  Geen *erc721* of nfpm_* ndjson-bestanden gevonden'); return 0; }

  let inserted = 0;
  for (const f of files) {
    const full = path.join(rawDir, f);
    const eventHint = f.replace(/\.ndjson$/,'');
    const content = fs.readFileSync(full, 'utf8');
    if (!content.trim()) { console.warn(`# ⚠️  Leeg bestand overgeslagen: ${f}`); continue; }
    const lines = content.split('\n').filter(Boolean);
    for (const line of lines) {
      let rec; try { rec = JSON.parse(line); } catch { continue; }
      const tx = rec.txHash || rec.transactionHash || rec.tx_hash || null;
      const idx = rec.logIndex ?? rec.log_index ?? null;
      if (tx == null || idx == null) continue;
      const blk = num(rec.blockNumber ?? rec.block_number);
      const ts  = toDate(rec.ts ?? rec.blockTime ?? rec.timeStamp);
      const contract = rec.address || rec.contract || null;
      const ev = (rec.event ? String(rec.event).toLowerCase() : null) || eventHint;
      await client.query(
        `insert into public.ingested_erc721_raw(contract,event,tx_hash,log_index,block_number,ts,raw)
           values($1,$2,$3,$4,$5,$6,$7)
         on conflict (tx_hash,log_index) do nothing`,
        [ low(contract), ev, String(tx), Number(idx), blk, ts, JSON.stringify(rec) ]
      );
      inserted++;
    }
  }
  return inserted;
};

const importPositions = async () => {
  if (!fs.existsSync) { /* node 18 doesn't have existsSync? it does */ }
  if (!fs.existsSync(pos and false)) return 0;
  let data;
  try { data = JSON.parse(fs.readFileSync(posPath,'utf8')); } catch { return 0; }
  const ids = Object.keys(data || {});
  let ins = 0;
  for (const id of ids) {
    const p = data[id];
    await client.query(
      `insert into public.ingested_positions (token_id,owner,pool,tick_lower,tick_upper,liquidity,tokens_owed0,tokens_owed1,last_event_block,data)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (token_id) do update set
         owner=excluded.owner, pool=excluded.pool, tick_lower=excluded.tick_lower, tick_upper=excluded.tick_upper,
         liquidity=excluded.liquidity, tokens_owed0=excluded.tokens_owed0, tokens_owed1=excluded.tokens_owed1, data=excluded.data`,
      [
        String(id),
        low(p?.owner),
        (p?.token0 || p?.token1) ? `${low(p?.token0)||''}-${low(p?.token1)||''}` : (p?.pool ?? null),
        p?.tickLower ?? null,
        p?.tickUpper ?? null,
        p?.liquidity ?? null,
        p?.tokensOwed0 ?? null,
        p?.tokensOwed1 ?? null,
        p?.lastEventBlock ?? null,
        JSON.stringify(p),
      ]
    );
    ins++;
  }
  return ins;
};

try {
  await client.connect();
  await ensureTables();
  const rawCount = await importRaw();
  const posCount = await importPositions();

  const r1 = await client.query('select count(*)::bigint as n from public.ingested_erc721_raw');
  const r2 = await client.query('select count(*)::bigint as n from public.ingested_positions');
  await client.end();
  console.log(JSON.stringify({ inserted_raw: rawCount, inserted_positions: posCount, totals: { erc721_raw: r1.rows[0].n, positions: r2.rows[0].n } }, null, 2));
} catch (e) {
  console.error('❌ Import error:', e);
  process.exit(1);
}
