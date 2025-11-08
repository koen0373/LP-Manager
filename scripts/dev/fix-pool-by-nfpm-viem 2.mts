import 'dotenv/config';
import 'dotenv-expand/config';
import { createPublicClient, http, parseAbi, getContract, Address } from 'viem';
import { Pool as PgPool } from 'pg';

const {
  ANKR_HTTP_URL,
  ENOSYS_NFPM,
  SPARKDEX_NFPM,
  ENOSYS_V3_FACTORY,
  SPARKDEX_V3_FACTORY,
  DATABASE_URL,
  RAW_DB,
} = process.env;

if (!ANKR_HTTP_URL) throw new Error('ANKR_HTTP_URL missing');
if (!ENOSYS_NFPM || !SPARKDEX_NFPM) throw new Error('NFPM env missing');
if (!ENOSYS_V3_FACTORY || !SPARKDEX_V3_FACTORY) throw new Error('Factory env missing');

const args = new Map(
  process.argv.slice(2).flatMap((kv) => {
    const [k, v] = kv.replace(/^--/, '').split('=');
    return [[k, v ?? 'true']];
  }),
);
const LIMIT = Number(args.get('limit') ?? 5000);
const OFFSET = Number(args.get('offset') ?? 0);
const CONCURRENCY = Math.min(Number(args.get('concurrency') ?? 10), 12);

const dsn =
  (DATABASE_URL && DATABASE_URL.split('?')[0]) ||
  (RAW_DB && RAW_DB.split('?')[0]) ||
  'postgresql://koen@localhost:5432/liquilab';
const db = new PgPool({ connectionString: dsn });

const client = createPublicClient({ transport: http(ANKR_HTTP_URL) });

const nfpmAbi = parseAbi([
  'function positions(uint256 tokenId) view returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)',
]);
const factoryAbi = parseAbi(['function getPool(address tokenA,address tokenB,uint24 fee) view returns (address)']);

const NFPM = [
  { label: 'enosys', addr: ENOSYS_NFPM as Address },
  { label: 'sparkdex', addr: SPARKDEX_NFPM as Address },
];
const FACTORIES: Address[] = [ENOSYS_V3_FACTORY as Address, SPARKDEX_V3_FACTORY as Address];

function pLimit(n: number) {
  const queue: Array<() => void> = [];
  let activeCount = 0;
  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      const fn = queue.shift();
      if (fn) fn();
    }
  };
  return function <T>(fn: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        activeCount++;
        fn()
          .then((value) => {
            resolve(value);
            next();
          })
          .catch((error) => {
            reject(error);
            next();
          });
      };
      if (activeCount < n) run();
      else queue.push(run);
    });
  };
}

async function fetchUnknownTokenIds(limit: number, offset: number): Promise<string[]> {
  const sql = `
    WITH u AS (
      SELECT DISTINCT "tokenId"
      FROM "PositionEvent"
      WHERE "pool" = 'unknown'
      ORDER BY "tokenId"
      LIMIT $1 OFFSET $2
    )
    SELECT "tokenId" FROM u
  `;
  const res = await db.query<{ tokenId: string }>(sql, [limit, offset]);
  return res.rows.map((row) => row.tokenId);
}

async function resolveFromNFPM(tokenId: string) {
  for (const nf of NFPM) {
    try {
      const contract = getContract({
        address: nf.addr,
        abi: nfpmAbi,
        client,
      });
      const result = await contract.read.positions([BigInt(tokenId)]);
      const token0 = result[2] as Address;
      const token1 = result[3] as Address;
      const fee = Number(result[4]);
      for (const factory of FACTORIES) {
        const facContract = getContract({
          address: factory,
          abi: factoryAbi,
          client,
        });
        const pool = await facContract.read.getPool([token0, token1, fee]);
        if (pool && pool !== '0x0000000000000000000000000000000000000000') {
          return pool;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function updatePool(tokenId: string, pool: string) {
  await db.query(
    `
      UPDATE "PositionEvent"
      SET "pool" = $2
      WHERE "tokenId" = $1
        AND "pool" = 'unknown'
    `,
    [tokenId, pool],
  );
}

async function main() {
  const tokenIds = await fetchUnknownTokenIds(LIMIT, OFFSET);
  console.log(`→ Unknown tokenIds fetched: ${tokenIds.length} (limit=${LIMIT}, offset=${OFFSET}, concurrency=${CONCURRENCY})`);
  if (!tokenIds.length) {
    console.log('✓ Nothing to do');
    await db.end();
    return;
  }

  const limit = pLimit(CONCURRENCY);
  let processed = 0;
  let resolved = 0;
  let skipped = 0;

  await Promise.all(
    tokenIds.map((tokenId) =>
      limit(async () => {
        const pool = await resolveFromNFPM(tokenId);
        if (pool) {
          await updatePool(tokenId, pool);
          resolved++;
        } else {
          skipped++;
        }
        processed++;
        if (processed % 100 === 0) {
          console.log(`  progress ${processed}/${tokenIds.length}, resolved=${resolved}, skipped=${skipped}`);
        }
      }),
    ),
  );

  const remaining = await db.query<{ left: number }>(
    `SELECT COUNT(*)::int AS left FROM "PositionEvent" WHERE "pool" = 'unknown'`,
  );

  console.log(
    `✓ Completed. processed=${processed}, resolved=${resolved}, skipped=${skipped}, remaining_unknown=${remaining.rows[0].left}`,
  );
  await db.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await db.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
