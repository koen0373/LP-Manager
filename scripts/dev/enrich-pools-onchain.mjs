import { Client } from 'pg';

const DB = process.env.DATABASE_URL;
const RPC = process.env.FLARE_RPC_URL || 'https://flare-api.flare.network/ext/C/rpc';
if (!DB) { console.error('Missing DATABASE_URL'); process.exit(1); }

const pg = new Client({ connectionString: DB, ssl: /localhost|127\.0\.0\.1/.test(DB) ? undefined : { rejectUnauthorized:false } });
const j = (m,p)=>({ jsonrpc:'2.0', id:1, method:m, params:p });
async function rpc(body){ const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); const jn=await r.json(); if(jn.error) throw new Error(jn.error.message); return jn.result; }

const sel = {
  token0:  '0dfe1681', // token0()
  token1:  'd21220a7', // token1()
  symbol:  '95d89b41', // symbol()
  name:    '06fdde03', // name()  (fallback info)
  decimals:'313ce567', // decimals()
};

function decodeAddress(ret){
  if(!ret || ret==='0x') return null;
  const hex = ret.slice(2).padStart(64,'0');
  return ('0x'+hex.slice(24,64)).toLowerCase();
}
function decodeUint(ret){
  if(!ret || ret==='0x') return null;
  const hex = ret.slice(2).padStart(64,'0');
  return parseInt(hex.slice(-64),16);
}
function decodeStringRobust(ret){
  if(!ret || ret==='0x') return '';
  try {
    // Try dynamic string: offset(32) | length(32) | bytes(length)
    const buf = Buffer.from(ret.slice(2),'hex');
    if (buf.length >= 96) {
      const len = parseInt(buf.slice(64,96).toString('hex')||'0',16);
      if (len > 0 && 96+len <= buf.length) {
        const s = buf.slice(96,96+len).toString('utf8').replace(/[^\x20-\x7E]/g,'').trim();
        if (s) return s;
      }
    }
    // Fallback: treat as bytes32 string (static)
    const hex = ret.slice(2).padStart(64,'0').slice(0,64);
    const raw = Buffer.from(hex,'hex').toString('utf8').replace(/\u0000+$/,'').replace(/[^\x20-\x7E]/g,'').trim();
    return raw;
  } catch { return ''; }
}

async function call(to, selector){
  try {
    const data = '0x'+selector;
    return await rpc(j('eth_call',[{ to, data }, 'latest']));
  } catch { return '0x'; }
}

async function enrichOne(poolAddr){
  const addr = poolAddr.toLowerCase();
  // Immutables
  const [r0, r1] = await Promise.all([ call(addr, sel.token0), call(addr, sel.token1) ]);
  const token0 = decodeAddress(r0), token1 = decodeAddress(r1);
  if (!token0 || !token1) return { ok:false, reason:'no_token_keys' };

  // ERC20 metadata
  const [s0, d0, s1, d1] = await Promise.all([
    call(token0, sel.symbol), call(token0, sel.decimals),
    call(token1, sel.symbol), call(token1, sel.decimals)
  ]);
  const token0Symbol = decodeStringRobust(s0) || null;
  const token1Symbol = decodeStringRobust(s1) || null;
  const token0Decimals = decodeUint(d0);
  const token1Decimals = decodeUint(d1);

  return {
    ok:true, token0, token1,
    token0Symbol, token1Symbol,
    token0Decimals: Number.isFinite(token0Decimals)? token0Decimals : null,
    token1Decimals: Number.isFinite(token1Decimals)? token1Decimals : null
  };
}

(async ()=>{
  await pg.connect();
  // Alleen pools zonder symbols
  const { rows } = await pg.query(`select "address" from "Pool" where "token0Symbol" is null or "token1Symbol" is null order by "blockNumber" asc`);
  if (!rows.length){ console.log('# No pools to enrich'); await pg.end(); process.exit(0); }

  let ok=0, skip=0, i=0;
  for (const r of rows){
    i++;
    const a = (r.address||"").toLowerCase();
    try {
      const meta = await enrichOne(a);
      if (!meta.ok) { skip++; console.log(`⊗ [${i}/${rows.length}] ${a} (no_token_keys)`); continue; }
      await pg.query(
        `update "Pool"
         set "token0"=$2,"token1"=$3,
             "token0Symbol"=coalesce($4,"token0Symbol"),
             "token1Symbol"=coalesce($5,"token1Symbol"),
             "token0Decimals"=coalesce($6,"token0Decimals"),
             "token1Decimals"=coalesce($7,"token1Decimals"),
             "updatedAt"=NOW()
         where lower("address") = $1`,
        [ a, meta.token0, meta.token1, meta.token0Symbol, meta.token1Symbol, meta.token0Decimals, meta.token1Decimals ]
      );
      ok++; console.log(`✓ [${i}/${rows.length}] ${a}  ${meta.token0Symbol||'?'} / ${meta.token1Symbol||'?'}  (${meta.token0Decimals??'?'} / ${meta.token1Decimals??'?'})`);
    } catch(e){
      skip++; console.log(`⊗ [${i}/${rows.length}] ${a} (err)`);
    }
  }
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Updated:   ${ok}
⊙ Skipped:    ${skip}
Total:        ${rows.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  await pg.end();
})().catch(async e=>{ console.error(e); try{await pg.end();}catch{} process.exit(1); });
