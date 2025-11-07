import 'dotenv/config';
import { Pool as PgPool } from 'pg';

type Transfer = {
  tokenId: string;
  transactionHash: string;
  logIndex: string | number;
  blockNumber: string | number;
  timestamp: string | number;
  fromAddress?: string;
  toAddress?: string;
};

const ZERO = '0x0000000000000000000000000000000000000000';
const {
  ANKR_API_KEY = '',
  ANKR_ADVANCED_API_URL,
  ENOSYS_NFPM,
  SPARKDEX_NFPM,
  RAW_DB,
  DATABASE_URL,
} = process.env;

if (!ENOSYS_NFPM || !SPARKDEX_NFPM) throw new Error('ENOSYS_NFPM / SPARKDEX_NFPM missing');

const ADV = (ANKR_ADVANCED_API_URL && ANKR_ADVANCED_API_URL.trim())
  || (ANKR_API_KEY ? `https://rpc.ankr.com/multichain/${ANKR_API_KEY}` : '');

if (!ADV) throw new Error('ANKR Advanced API endpoint missing');

const dsn = (DATABASE_URL && DATABASE_URL.split('?')[0])
  || (RAW_DB && RAW_DB.split('?')[0])
  || 'postgresql://koen@localhost:5432/liquilab';
const db = new PgPool({ connectionString: dsn });

async function ensureTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "PositionTransfer" (
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
  await db.query(`
    CREATE TABLE IF NOT EXISTS "PositionEvent" (
      "tokenId" TEXT NOT NULL,
      "pool" TEXT NOT NULL DEFAULT 'unknown',
      "blockNumber" INTEGER NOT NULL,
      "txHash" TEXT NOT NULL,
      "logIndex" INTEGER NOT NULL,
      "eventName" TEXT NOT NULL,
      "tickLower" INTEGER NOT NULL DEFAULT 0,
      "tickUpper" INTEGER NOT NULL DEFAULT 0,
      "timestamp" INTEGER NOT NULL,
      PRIMARY KEY ("txHash","logIndex")
    );
  `);
}

async function callAdvanced(method: string, params: Record<string,unknown>) {
  const body = { jsonrpc: '2.0', id: 1, method, params };
  const res = await fetch(ADV, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`ANKR HTTP ${res.status}: ${await res.text().catch(()=> '')}`);
  const json: any = await res.json();
  if (json.error) throw new Error(`ANKR error: ${JSON.stringify(json.error)}`);
  return json.result ?? {};
}

function norm(rows: Transfer[], nfpm: string) {
  return rows.map(r => ({
    tokenId: String(r.tokenId),
    txHash: String(r.transactionHash),
    logIndex: Number(r.logIndex),
    blockNumber: Number(r.blockNumber),
    timestamp: Number(r.timestamp),
    from: (r.fromAddress ?? ZERO).toLowerCase(),
    to: (r.toAddress ?? ZERO).toLowerCase(),
    nfpm,
  }));
}

async function upsertTransfers(rows: ReturnType<typeof norm>) {
  if (!rows.length) return;
  const placeholders = rows.map((_, i) => {
    const b = i*8;
    return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8})`;
  }).join(',');
  const sql = `
    INSERT INTO "PositionTransfer"
      ("id","tokenId","from","to","blockNumber","txHash","logIndex","timestamp")
    VALUES ${placeholders}
    ON CONFLICT ("id") DO UPDATE SET
      "from"=EXCLUDED."from","to"=EXCLUDED."to","blockNumber"=EXCLUDED."blockNumber","timestamp"=EXCLUDED."timestamp"
  `;
  const vals = rows.flatMap(r => [
    `${r.txHash}:${r.logIndex}`, r.tokenId, r.from, r.to, r.blockNumber, r.txHash, r.logIndex, r.timestamp
  ]);
  await db.query(sql, vals);
}

async function upsertMints(rows: ReturnType<typeof norm>) {
  const mints = rows.filter(r => r.from === ZERO);
  if (!mints.length) return;
  const placeholders = mints.map((_, i) => {
    const b = i*9;
    return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},'Mint',0,0,$${b+6})`;
  }).join(',');
  const sql = `
    INSERT INTO "PositionEvent"
      ("tokenId","pool","blockNumber","txHash","logIndex","eventName","tickLower","tickUpper","timestamp")
    VALUES ${placeholders}
    ON CONFLICT ("txHash","logIndex") DO NOTHING
  `;
  const vals = mints.flatMap(r => [r.tokenId, 'unknown', r.blockNumber, r.txHash, r.logIndex, r.timestamp]);
  await db.query(sql, vals);
}

async function backfillNFPM(contract: string) {
  console.log(`→ Scanning NFPM ${contract}`);
  let pageToken: string | undefined;
  let total = 0;
  do {
    const result = await callAdvanced('ankr_getNFTTransfers', {
      blockchain: 'flare',
      contractAddress: contract,
      pageSize: 1000,
      pageToken
    });
    const transfers = Array.isArray(result.transfers) ? result.transfers as Transfer[] : [];
    const rows = norm(transfers, contract);
    await upsertTransfers(rows);
    await upsertMints(rows);
    total += rows.length;
    pageToken = result.nextPageToken;
    console.log(`   +${rows.length} (total ${total})`);
  } while (pageToken);
  console.log(`✓ Completed NFPM ${contract} (${total})`);
}

async function main() {
  await ensureTables();
  for (const c of [String(ENOSYS_NFPM), String(SPARKDEX_NFPM)]) {
    await backfillNFPM(c);
  }
  await db.end();
  console.log('All NFPM scans completed.');
}

main().catch(err => { console.error(err); db.end().catch(()=>{}); process.exit(1); });
