import 'dotenv/config';
import { Pool } from 'pg';
import { http, createPublicClient, parseAbi, defineChain, getAddress } from 'viem';
import pLimit from 'p-limit';

const {
  ANKR_HTTP_URL,
  ENOSYS_NFPM,
  SPARKDEX_NFPM,
  ENOSYS_V3_FACTORY,
  SPARKDEX_V3_FACTORY,
  RAW_DB,
  DATABASE_URL,
} = process.env;

if (!ANKR_HTTP_URL) throw new Error('ANKR_HTTP_URL not set');
if (!ENOSYS_NFPM || !SPARKDEX_NFPM) throw new Error('NFPM env missing');
if (!ENOSYS_V3_FACTORY || !SPARKDEX_V3_FACTORY) throw new Error('Factory env missing');

const flare = defineChain({
  id: 14,
  name: 'Flare',
  nativeCurrency: { name: 'FLR', symbol: 'FLR', decimals: 18 },
  rpcUrls: { default: { http: [ANKR_HTTP_URL] } },
});

const client = createPublicClient({ chain: flare, transport: http(ANKR_HTTP_URL!) });

const NFPM_ABI = parseAbi([
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
]);

const FACTORY_ABI = parseAbi([
  'function getPool(address token0, address token1, uint24 fee) view returns (address)'
]);

// Kies factory op basis van waar de positie vandaan komt (we weten dat niet 100% uit DB -> probeer beide, stop bij eerste non-zero)
const factories = [ENOSYS_V3_FACTORY!, SPARKDEX_V3_FACTORY!];

const dsn =
  (DATABASE_URL && DATABASE_URL.split('?')[0]) ||
  (RAW_DB && RAW_DB.split('?')[0]) ||
  'postgresql://koen@localhost:5432/liquilab';

const db = new Pool({ connectionString: dsn });

// Haal unknown tokenIds (distinct) met limiet & offset via args
const arg = (name: string, def?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const LIMIT = parseInt(arg('limit', '5000')!, 10);
const OFFSET = parseInt(arg('offset', '0')!, 10);
const CONCURRENCY = parseInt(arg('concurrency', '8')!, 10);

async function selectUnknownTokenIds() {
  const q = `
    WITH u AS (
      SELECT "tokenId" FROM "PositionEvent"  WHERE "pool"='unknown'
      UNION
      SELECT "tokenId" FROM "PositionTransfer"
    )
    SELECT DISTINCT u."tokenId"
    FROM u
    LEFT JOIN (
      SELECT "tokenId", MAX(NULLIF("pool",'unknown')) AS mapped_pool
      FROM "PositionEvent" GROUP BY 1
    ) m ON m."tokenId" = u."tokenId"
    WHERE COALESCE(m.mapped_pool,'unknown')='unknown'
    ORDER BY u."tokenId"
    LIMIT $1 OFFSET $2;
  `;
  const res = await db.query<{ tokenId: string }>(q, [LIMIT, OFFSET]);
  return res.rows.map(r => r.tokenId);
}

async function resolvePoolForToken(tokenId: string): Promise<string | null> {
  // Probeer eerst ENOSYS_NFPM, dan SPARKDEX_NFPM (sommige tokens bestaan maar in één)
  const nfpmAddrs = [ENOSYS_NFPM!, SPARKDEX_NFPM!];
  for (const nfpm of nfpmAddrs) {
    try {
      const pos: any = await client.readContract({
        address: getAddress(nfpm),
        abi: NFPM_ABI,
        functionName: 'positions',
        args: [BigInt(tokenId)],
      });
      const token0: `0x${string}` = pos[2];
      const token1: `0x${string}` = pos[3];
      const fee: number = Number(pos[4]);
      if (!token0 || !token1 || !fee) continue;

      // Resolve via beide factories, neem eerste non-zero
      for (const fac of factories) {
        const pool: `0x${string}` = await client.readContract({
          address: getAddress(fac),
          abi: FACTORY_ABI,
          functionName: 'getPool',
          args: [getAddress(token0), getAddress(token1), fee],
        });
        if (pool && pool !== '0x0000000000000000000000000000000000000000') {
          return pool.toLowerCase();
        }
      }
    } catch {
      // stil door naar volgende NFPM
    }
  }
  return null;
}

async function updateTokenPool(tokenId: string, pool: string) {
  // Schrijf naar alle onbekende PositionEvent rijen + houd mapping vast in hulpschema
  await db.query('UPDATE "PositionEvent" SET "pool"=$2 WHERE "tokenId"=$1 AND "pool"=$3', [tokenId, pool, 'unknown']);
}

async function main() {
  console.log(`→ Resolving pools for unknown tokenIds (limit=${LIMIT}, offset=${OFFSET}, concurrency=${CONCURRENCY})`);
  const ids = await selectUnknownTokenIds();
  console.log(`  candidates: ${ids.length}`);

  const limit = pLimit(CONCURRENCY);
  let fixed = 0;

  await Promise.all(ids.map(id => limit(async () => {
    const pool = await resolvePoolForToken(id);
    if (pool) {
      await updateTokenPool(id, pool);
      fixed++;
      if (fixed % 100 === 0) console.log(`  fixed so far: ${fixed}`);
    }
  })));

  console.log(`✓ done. fixed=${fixed}`);

  // kleine sanity teller
  const rest = await db.query('SELECT COUNT(*)::int AS left FROM "PositionEvent" WHERE "pool"=$1', ['unknown']);
  console.log(`  unknown_left=${rest.rows[0].left}`);
  await db.end();
}

main().catch(async (e) => {
  console.error(e);
  try { await db.end(); } catch {}
  process.exit(1);
});
