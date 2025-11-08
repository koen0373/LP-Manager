import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('Missing DATABASE_URL env');
  process.exit(1);
}

const client = new Client({
  connectionString: conn,
  ssl: /sslmode=require|sslmode=true/.test(conn) ? { rejectUnauthorized: false } : undefined,
});

function readLines(p) {
  try { return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean); }
  catch { return []; }
}
function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function num(v) { if (v === null || v === undefined) return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function toLowerOrNull(v){ return typeof v === 'string' ? v.toLowerCase() : (v ? String(v).toLowerCase() : null); }

(async () => {
  await client.connect();

  // Create minimal ingest tables in public schema (no conflict with Prisma models)
  await client.query(`
    create table if not exists public.ingested_pools (
      id text primary key,
      factory text,
      token0 text,
      token1 text,
      fee integer,
      tick_spacing integer,
      created_at_block bigint,
      created_at_ts timestamptz,
      raw jsonb
    );
  `);
  await client.query(`
    create table if not exists public.ingested_positions (
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
    );
  `);

  const root = process.cwd();
  const poolFiles = [
    path.join(root, 'data', 'core', 'pools.ndjson'),
    path.join(root, 'data', 'pools.ndjson'),
  ];
  let poolInserts = 0;
  for (const f of poolFiles) {
    if (!fs.existsSync(f)) continue;
    for (const line of readLines(f)) {
      try {
        const rec = JSON.parse(line);
        const id = toLowerOrNull(rec.pool ?? rec.address);
        if (!id) continue;
        const factory = toStringSafe(rec.factory);
        const token0 = toStringSafe(rec.token0);
        const token1 = toStringSafe(rec.token1);
        const fee = num(rec.fee);
        const tick_spacing = num(rec.tickSpacing);
        const created_at_block = num(rec.createdAtBlock);
        const created_at_ts = rec.createdAtTs ? new Date(rec.createdAtTs) : null;
        await client.query(
          `insert into public.ingested_pools (id, factory, token0, token1, fee, tick_spacing, created_at_block, created_at_ts, raw)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           on conflict (id) do update set
             factory = excluded.factory,
             token0 = excluded.token0,
             token1 = excluded.token1,
             fee = excluded.fee,
             tick_spacing = excluded.tick_spacing,
             created_at_block = excluded.created_at_block,
             created_at_ts = excluded.created_at_ts,
             raw = excluded.raw`,
          [id, factory, token0, token1, fee, tick_spacing, created_at_block, created_at_ts, JSON.stringify(rec)]
        );
        poolInserts++;
      } catch {}
    }
  }

  let posInserts = 0;
  const posPath = path.join(root, 'data', 'enriched', 'enc_positions.json'); // our earlier code wrote positions.json; also support both
  const posAltPath = path.join(root, 'data', 'enriched', 'positions.json');
  const posObj = readJson(fs.existsSync(posPath) ? posPath : (fs.existsSync(posAltPath) ? posAltPath : ''));
  if (posObj) {
    for (const [tokenId, p] of Object.entries(posObj)) {
      const owner = toLowerOrNull(p.owner);
      const pool = p.pool ?? (p.token0 && p.token1 ? `${toLowerOrNull(p.token0)}-${toLowerOrNull(p.token1)}` : null);
      const tick_lower = num(p.tickLower);
      const tick_upper = num(p.tickUpper);
      const liquidity = toStringSafe(p.liquidity);
      const tokens_owed0 = toStringSafe(p.tokensOwed0);
      const tokens_owed1 = toStringSafe(p.tokensOwed1);
      const last_event_block = num(p.lastEventBlock);
      await client.query(
        `insert into public.ingested_positions (token_id, owner, pool, tick_lower, tick_upper, liquidity, tokens_owed0, tokens_owed1, last_event_block, data)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (token_id) do update set
           owner = excluded.owner,
           pool = excluded.pool,
           tick_lower = excluded.tick_lower,
           tick_upper = excluded.tick_upper,
           liquidity = excluded.liquidity,
           tokens_owed0 = excluded.tokens_owed0,
           tokens_owed1 = excluded.tokens_owed1,
           last_event_block = excluded.last_event_block,
           data = excluded.data`,
        [String(tokenId), owner, pool, tick_lower, tick_upper, toStringSafe(liquidity), toStringSafe(tokens_owed0), toStringSafe(tokens_owed1), last_event_block, JSON.stringify(p)]
      );
      posInserts++;
    }
  }

  console.log(JSON.stringify({ inserted: { pools: poolInserts, positions: posInserts } }, null, 2));
  await client.end();

  function toStringSafe(v){ if (v===null||v===undefined) return null; const s=String(v); return s.length? s : null; }
  function toStringSafeLower(v){ const s=toStringSafe(v); return s? s.toLowerCase():s; }
})();
