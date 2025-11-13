import fs from 'fs';
import readline from 'node:readline';
import { Client } from 'pg';

const CSV='data/import/ankr.csv';
if(!fs.existsSync(CSV)){ console.error('CSV ontbreekt:', CSV); process.exit(1); }
const conn=process.env.DATABASE_URL;
if(!conn){ console.error('DATABASE_URL ontbreekt'); process.exit(1); }

/**
 * Belangrijk: we zetten ssl.rejectUnauthorized=false in deze import-run
 * om “SELF_SIGNED_CERT_IN_CHAIN” lokaal te omzeilen. Productie moet met
 * geldige keten draaien (Railway regelt dat).
 */
const client=new Client({
  connectionString: conn,
  ssl: { rejectUnauthorized: false }
});

const low=v=>v==null?null:String(v).toLowerCase();
const num=v=>v==null||v===''?null:(Number.isFinite(+v)?+v:null);
const toDate=v=>{
  if(!v) return null;
  const n=+v; if(Number.isFinite(n)) return new Date(n*1000);
  const d=new Date(v); return isNaN(+d)?null:d;
};

const mapIdx=h=>{
  const L=h.map(x=>String(x||'').trim().toLowerCase());
  const f=(...alts)=>{ for(const k of alts){ const i=L.indexOf(String(k).toLowerCase()); if(i!==-1) return i; } return -1; };
  return {
    address:      f('address','contract','log_address'),
    event:        f('event','type','topicname','kind'),
    tx_hash:      f('tx_hash','transactionhash','txhash','hash'),
    log_index:    f('log_index','logindex','idx'),
    block_number: f('block_number','blocknumber','bn','block'),
    timestamp:    f('timestamp','timestamp_unix','time','timestamp (utc)','ts','timestampms','timeStamp')
  };
};

(async ()=>{
  await client.connect();
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

  const rl = readline.createInterface({ input: fs.createReadStream(CSV) });
  let header, idx, ins=0, line=0;

  for await (const ln of rl){
    line++;
    if(!ln.trim()) continue;
    const parts = ln.split(',').map(s=>s.replace(/^"|"$/g,'').trim());
    if(!header){ header=parts; idx=mapIdx(header); continue; }

    const pick=i=> (i>=0&&i<parts.length)?parts[i]:null;
    const rec = {
      contract: pick(idx.address),
      event:    pick(idx.event) || 'erc721_transfer',
      tx:       pick(idx.tx_hash),
      logIdx:   num(pick(idx.log_index)),
      block:    num(pick(idx.block_number)),
      ts:       toDate(pick(idx.timestamp))
    };
    if(!rec.tx || rec.logIdx==null) continue;

    const raw = Object.fromEntries(header.map((h,i)=>[h,parts[i]]));
    await client.query(
      `insert into public.ingested_erc721_raw (contract,event,tx_hash,log_index,block_number,ts,raw)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (tx_hash,log_index) do nothing`,
      [ low(rec.contract), String(rec.event).toLowerCase(), String(rec.tx), rec.logIdx, rec.block, rec.ts, JSON.stringify(raw) ]
    );
    ins++;
  }

  const { rows:[r] } = await client.query('select count(*)::bigint as n from public.ingested_erc721_raw');
  await client.end();
  console.log(JSON.stringify({ inserted: ins, total: r.n }, null, 2));
})().catch(e=>{ console.error('Import error:', e); process.exit(1); });
