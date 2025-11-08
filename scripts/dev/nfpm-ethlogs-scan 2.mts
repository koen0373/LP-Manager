import 'dotenv/config';
import { Pool as PgPool } from 'pg';

const ZERO = '0x0000000000000000000000000000000000000000';
const TOPIC_TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const { ANKR_HTTP_URL, ENOSYS_NFPM, SPARKDEX_NFPM, RAW_DB, DATABASE_URL } = process.env;
if (!ANKR_HTTP_URL) throw new Error('ANKR_HTTP_URL missing');
if (!ENOSYS_NFPM || !SPARKDEX_NFPM) throw new Error('ENOSYS_NFPM / SPARKDEX_NFPM missing');

const dsn = (DATABASE_URL?.split('?')[0]) || (RAW_DB?.split('?')[0]) || 'postgresql://koen@localhost:5432/liquilab';
const db = new PgPool({ connectionString: dsn });

function toHex(n:number){ return '0x'+n.toString(16); }
function hexToInt(h:string){ return parseInt(h,16); }
async function rpc(method:string, params:any){
  const res = await fetch(String(ANKR_HTTP_URL), {
    method:'POST',
    headers:{'content-type':'application/json'},
    body: JSON.stringify({ jsonrpc:'2.0', id:1, method, params })
  });
  const j:any = await res.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}
async function getBlockTs(b:number){
  const r:any = await rpc('eth_getBlockByNumber',[toHex(b), false]);
  return r?.timestamp ? hexToInt(r.timestamp) : 0;
}
function topicAddrToHex(t:string){ return '0x'+String(t).slice(-40).toLowerCase(); }

async function ensureTables(){
  await db.query(`
    CREATE TABLE IF NOT EXISTS "PositionTransfer"(
      "id" TEXT PRIMARY KEY,
      "tokenId" TEXT NOT NULL,
      "from" TEXT NOT NULL,
      "to" TEXT NOT NULL,
      "blockNumber" INTEGER NOT NULL,
      "txHash" TEXT NOT NULL,
      "logIndex" INTEGER NOT NULL,
      "timestamp" INTEGER NOT NULL
    );
  `);

  /* NB: we maken hier geen schema-fixes; we schrijven schema-aware. */
}

/** Detecteer kolommen van PositionEvent zodat we correct kunnen inserten. */
async function detectPositionEventShape(): Promise<{
  hasId: boolean,
  hasEventType: boolean,
  hasEventName: boolean
}>{
  const r = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='PositionEvent'
  `);
  const cols = new Set(r.rows.map(x => x.column_name));
  return {
    hasId: cols.has('id'),
    hasEventType: cols.has('eventType'),
    hasEventName: cols.has('eventName'),
  };
}

type Xfer = {
  id: string;
  tokenId: string;
  from: string;
  to: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  timestamp: number;
};

async function upsertTransfers(rows: Xfer[]){
  if (!rows.length) return;
  const vals = rows.flatMap(r=>[r.id,r.tokenId,r.from,r.to,r.blockNumber,r.txHash,r.logIndex,r.timestamp]);
  const place = rows.map((_,i)=>`($${i*8+1},$${i*8+2},$${i*8+3},$${i*8+4},$${i*8+5},$${i*8+6},$${i*8+7},$${i*8+8})`).join(',');
  await db.query(
    `INSERT INTO "PositionTransfer"("id","tokenId","from","to","blockNumber","txHash","logIndex","timestamp")
     VALUES ${place}
     ON CONFLICT ("id") DO UPDATE SET
       "from"=EXCLUDED."from",
       "to"=EXCLUDED."to",
       "blockNumber"=EXCLUDED."blockNumber",
       "timestamp"=EXCLUDED."timestamp"`,
    vals
  );
}

/** Mints = from == ZERO. Schrijf PositionEvent met id = txHash:logIndex. */
async function upsertMints(
  rows,
  shape, // { hasId: boolean; hasEventType: boolean; hasEventName: boolean }
) {
  const mints = rows.filter((r) => r.from === ZERO);
  if (!mints.length) return;

  const baseCols = ['"tokenId"','"pool"','"blockNumber"','"txHash"','"logIndex"','"tickLower"','"tickUpper"','"timestamp"'];

  if (shape.hasEventType) {
    const cols = (shape.hasId ? ['"id"', ...baseCols] : [...baseCols]).concat('"eventType"');
    const makeSql = (paramCount) => `
      INSERT INTO "PositionEvent"(${cols.join(',')})
      VALUES (${Array.from({length:paramCount}, (_,i)=>`$${i+1}`).join(', ')}, 'MINT'::"PositionEventType")
      ON CONFLICT ("txHash","logIndex") DO NOTHING`;

    for (const r of mints) {
      const params = [];
      if (shape.hasId) params.push(`${r.txHash}:${r.logIndex}`);
      params.push(r.tokenId, 'unknown', r.blockNumber, r.txHash, r.logIndex, 0, 0, r.timestamp);
      const sql = makeSql(params.length);
      await db.query(sql, params);
    }
  } else {
    const tailCol = shape.hasEventName ? '"eventName"' : null;
    const cols = (shape.hasId ? ['"id"', ...baseCols] : [...baseCols]).concat(tailCol ? [tailCol] : []);
    const makeSql = (paramCount) => `
      INSERT INTO "PositionEvent"(${cols.join(',')})
      VALUES (${Array.from({length:paramCount}, (_,i)=>`$${i+1}`).join(', ')})
      ON CONFLICT ("txHash","logIndex") DO NOTHING`;

    for (const r of mints) {
      const params = [];
      if (shape.hasId) params.push(`${r.txHash}:${r.logIndex}`);
      params.push(r.tokenId, 'unknown', r.blockNumber, r.txHash, r.logIndex, 0, 0, r.timestamp);
      if (tailCol) params.push('Mint');
      const sql = makeSql(params.length);
      await db.query(sql, params);
    }
  }
}

function mapLogsToXfers(logs:any[]): Xfer[] {
  return logs.map(l => ({
    id: `${String(l.transactionHash)}:${hexToInt(l.logIndex)}`,
    tokenId: BigInt(l.topics[3]).toString(),
    from: topicAddrToHex(String(l.topics[1])),
    to: topicAddrToHex(String(l.topics[2])),
    blockNumber: hexToInt(l.blockNumber),
    txHash: String(l.transactionHash),
    logIndex: hexToInt(l.logIndex),
    timestamp: 0, // vullen we zo met blok-timestamps
  }));
}

async function backfill(contract:string, start:number, step=10_000, shape:{hasId:boolean, hasEventType:boolean, hasEventName:boolean}){
  console.log(`→ NFPM ${contract} (from ${start})`);
  const head = parseInt(await rpc('eth_blockNumber',[]),16);
  for (let from=start; from<=head; from += step){
    const to = Math.min(from+step-1, head);
    const logs:any[] = await rpc('eth_getLogs', [{ address: contract, fromBlock: toHex(from), toBlock: toHex(to), topics:[TOPIC_TRANSFER]}]);
    if (logs.length){
      const rows = mapLogsToXfers(logs);
      const blocks = [...new Set(rows.map(r=>r.blockNumber))];
      const tsMap = new Map<number,number>();
      await Promise.all(blocks.map(async b => tsMap.set(b, await getBlockTs(b))));
      rows.forEach(r => r.timestamp = tsMap.get(r.blockNumber) ?? 0);

      await upsertTransfers(rows);
      await upsertMints(rows, shape);
    }
    console.log(`  ${from}-${to}: +${logs.length}`);
  }
  console.log(`✓ NFPM ${contract} done`);
}

async function main(){
  await ensureTables();
  const shape = await detectPositionEventShape();
  const enosysStart = 29837200, sparkdexStart = 30617263;
  await backfill(String(ENOSYS_NFPM), enosysStart, 10_000, shape);
  await backfill(String(SPARKDEX_NFPM), sparkdexStart, 10_000, shape);
  await db.end();
  console.log('All NFPM scans completed.');
}

main().catch(e=>{ console.error(e); db.end().catch(()=>{}); process.exit(1); });
