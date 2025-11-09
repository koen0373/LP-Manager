import { Client } from 'pg';

const DB = process.env.DATABASE_URL;
const RPC = process.env.FLARE_RPC_URL || 'https://flare-api.flare.network/ext/C/rpc';
if (!DB) { console.error('Missing DATABASE_URL'); process.exit(1); }

const pg = new Client({ connectionString: DB, ssl: /localhost|127\.0\.0\.1/.test(DB) ? undefined : { rejectUnauthorized:false } });
const post = async (body) => {
  const r = await fetch(RPC,{ method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
  const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result;
};
const hex = n => '0x'+Number(n).toString(16);

const SIG = {
  token0: '0dfe1681',   // token0()
  token1: 'd21220a7',   // token1()
  fee:    'ddca3f43',   // fee()
  factory:'c45a0155',   // factory()
};

const decodeAddr = (ret) => {
  if (!ret || ret==='0x') return null;
  const h = ret.slice(2).padStart(64,'0');
  return ('0x'+h.slice(24,64)).toLowerCase();
};
const decodeUint = (ret) => {
  if (!ret || ret==='0x') return null;
  return parseInt(ret.slice(-64),16);
};

async function call(to, selector){
  const body = { jsonrpc:'2.0', id:1, method:'eth_call', params:[{to, data:'0x'+selector}, 'latest'] };
  return await post(body);
}

(async ()=>{
  await pg.connect();

  // 1) Verzamel pools zonder entry in "Pool"
  const q = `
    with created as (
      select distinct pe."pool" as address
      from "PoolEvent" pe
      where pe."eventName"='PoolCreated'
    )
    select c.address
    from created c
    left join "Pool" p on p.address = lower(c.address)
    where p.address is null
  `;
  const { rows } = await pg.query(q);
  if (!rows.length) { console.log('# Geen nieuwe pools te hydrateren'); await pg.end(); process.exit(0); }

  let ok=0, skip=0, i=0;
  for (const {address} of rows) {
    i++;
    const addr = String(address).toLowerCase();
    try {
      const [r0,r1,rf,rfac] = await Promise.all([
        call(addr,SIG.token0), call(addr,SIG.token1), call(addr,SIG.fee), call(addr,SIG.factory)
      ]);
      const token0 = decodeAddr(r0), token1 = decodeAddr(r1);
      const fee = decodeUint(rf);
      const factory = decodeAddr(rfac);

      if (!token0 || !token1 || fee===null || !factory) {
        skip++; console.log(`⊗ [${i}/${rows.length}] ${addr} (missing immutables)`); continue;
      }

      // created block/tx uit PoolEvent
      const { rows: meta } = await pg.query(
        `select "blockNumber","txHash" from "PoolEvent" where "eventName"='PoolCreated' and "pool"=$1 order by "blockNumber" asc limit 1`,
        [address]
      );
      const blockNumber = meta[0]?.blockNumber ?? 0;
      const txHash = meta[0]?.txHash ?? null;

      await pg.query(
        `insert into "Pool" ("address","token0","token1","fee","factory","blockNumber","txHash","createdAt","updatedAt")
         values ($1,$2,$3,$4,$5,$6,$7, NOW(), NOW())
         on conflict ("address") do nothing`,
        [addr, token0, token1, fee, factory, blockNumber, txHash]
      );
      ok++; console.log(`✓ [${i}/${rows.length}] ${addr}  fee=${fee}  ${token0} / ${token1}`);
    } catch (e) {
      skip++; console.log(`⊗ [${i}/${rows.length}] ${addr} (err)`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Inserted: ${ok}
⊙ Skipped:  ${skip}
Total:      ${rows.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  await pg.end();
})().catch(async e=>{ console.error(e); try{await pg.end();}catch{} process.exit(1); });
