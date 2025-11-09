import { Client } from 'pg';

const DB = process.env.DATABASE_URL;
const RPC = process.env.FLARE_RPC_URL || 'https://flare-api.flare.network/ext/C/rpc';
const F_ENO = (process.env.ENOSYS_V3_FACTORY||'').toLowerCase();
const F_SPK = (process.env.SPARKDEX_V3_FACTORY||'').toLowerCase();
if (!DB) { console.error('Missing DATABASE_URL'); process.exit(1); }
if (!F_ENO || !F_SPK) { console.error('Missing factory envs'); process.exit(1); }

const pg = new Client({ connectionString: DB, ssl: /localhost|127\.0\.0\.1/.test(DB) ? undefined : { rejectUnauthorized:false }});
const post = async (b)=>{ const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}); const j=await r.json(); if(j.error) throw new Error(j.error.message); return j.result; };
const hex = n=>'0x'+Number(n).toString(16);
const TOPIC_POOLCREATED = '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b6c8ff7ca'; // PoolCreated(address,address,uint24,int24,address)

function topicAddr(t){ // topic is 32 bytes; last 20 bytes are address
  return ('0x'+t.slice(-40)).toLowerCase();
}
function topicUint24(t){ return parseInt(t.slice(-6),16); }
function topicInt24(t){ let x = parseInt(t.slice(-6),16); if (x & 0x800000) x = x - 0x1000000; return x; } // not used but kept

(async ()=>{
  await pg.connect();
  // Pak alle pool-adressen + blockNumber uit PoolEvent (PoolCreated) waarvoor Pool nog geen token0Symbol heeft
  const { rows } = await pg.query(`
    select pe."pool" as pool, pe."blockNumber" as blockNumber
    from "PoolEvent" pe
    left join "Pool" p on lower(p."address") = lower(pe."pool")
    where pe."eventName" = 'PoolCreated'
      and (p."token0Symbol" is null or p."token1Symbol" is null or p."token0" is null or p."token1" is null)
    group by pe."pool", pe."blockNumber"
    order by pe."blockNumber" asc
  `);

  if (!rows.length){ console.log('# No PoolCreated to re-decode'); await pg.end(); process.exit(0); }

  let updated=0, skipped=0, i=0;
  for (const r of rows){
    i++;
    const pool = String(r.pool).toLowerCase();
    const bn = Number(r.blockNumber);
    try{
      // Vraag exact dit block op bij beide factories
      const addr = [F_ENO, F_SPK];
      const result = await post({jsonrpc:'2.0', id:1, method:'eth_getLogs', params:[{
        fromBlock: hex(bn), toBlock: hex(bn), address: addr, topics: [TOPIC_POOLCREATED]
      }]});
      const logs = result || [];
      // Vind het log waarvoor topic[4] (pool address) overeenkomt met onze pool
      const hit = logs.find(l => (l.topics?.[4] ? topicAddr(l.topics[4]) : '') === pool);
      if (!hit) { skipped++; process.stdout.write(`⊗ [${i}/${rows.length}] ${pool} @${bn} (no matching log)\n`); continue; }

      const token0 = topicAddr(hit.topics[1]);
      const token1 = topicAddr(hit.topics[2]);
      const fee = topicUint24(hit.topics[3]);
      const factory = String(hit.address||'').toLowerCase();

      await pg.query(`
        insert into "Pool" ("address","token0","token1","fee","factory","blockNumber","txHash","createdAt","updatedAt")
        values ($1,$2,$3,$4,$5,$6,$7, NOW(), NOW())
        on conflict ("address") do update set
          "token0"=$2, "token1"=$3, "fee"=$4, "factory"=$5, "blockNumber"=least("blockNumber",$6), "txHash"=coalesce("txHash",$7), "updatedAt"=NOW()
      `,[ pool, token0, token1, fee, factory, Number(hit.blockNumber), String(hit.transactionHash) ]);

      updated++; process.stdout.write(`✓ [${i}/${rows.length}] ${pool} fee=${fee}  ${token0}/${token1}\n`);
    }catch(e){
      skipped++; process.stdout.write(`⊗ [${i}/${rows.length}] ${pool} @${bn} (err)\n`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Updated:   ${updated}
⊙ Skipped:    ${skipped}
Total:        ${rows.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  await pg.end();
})().catch(async e=>{ console.error(e); try{await pg.end();}catch{} process.exit(1); });
