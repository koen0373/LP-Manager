import { Prisma, PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const HISTORY_PATH = path.join(process.cwd(), 'public', 'demo.history.json');
const MIN_INTERVAL_MS = 20 * 60 * 60 * 1000;
const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

type HistoryPoint = {
  ts: string;
  tvlUsd: number;
  poolCount: number;
};

type TotalsRow = {
  pool_count: bigint | number;
  total_tvl_usd: Prisma.Decimal | number | null;
};

async function main() {
  try {
    const totals = await fetchTotals();
    const history = await readHistory();
    const now = new Date();

    if (!shouldAppend(history, now)) {
      console.log('[demo-history] Skipped append (last entry < 20h old).');
      return;
    }

    const nextEntry: HistoryPoint = {
      ts: now.toISOString(),
      tvlUsd: totals.totalTvlUsd,
      poolCount: totals.poolCount,
    };

    const updated = [...history, nextEntry].filter((entry) => now.getTime() - new Date(entry.ts).getTime() <= RETENTION_MS);
    await writeHistory(updated);
    console.log('[demo-history] Appended new entry', nextEntry);
  } catch (error) {
    console.error('[demo-history] Failed to update history', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

async function fetchTotals(): Promise<{ totalTvlUsd: number; poolCount: number; }> {
  const rows = await prisma.$queryRaw<TotalsRow[]>(Prisma.sql`
    WITH latest_snapshot AS (
      SELECT
        am."poolAddress" AS pool_address,
        snap."tvlUsd"    AS tvl_usd,
        ROW_NUMBER() OVER (PARTITION BY am."poolAddress" ORDER BY snap."ts" DESC) AS rn
      FROM "analytics_market" am
      JOIN "analytics_market_snapshot" snap ON snap."marketIdFk" = am."id"
      WHERE am."poolAddress" IS NOT NULL
    )
    SELECT
      COUNT(*) FILTER (WHERE pool_address IS NOT NULL) AS pool_count,
      COALESCE(SUM(tvl_usd), 0) AS total_tvl_usd
    FROM latest_snapshot
    WHERE rn = 1
  `);

  const row = rows[0] ?? { pool_count: 0, total_tvl_usd: 0 };
  return {
    poolCount: Number(row.pool_count ?? 0),
    totalTvlUsd: toNumber(row.total_tvl_usd) ?? 0,
  };
}

async function readHistory(): Promise<HistoryPoint[]> {
  try {
    const content = await fs.readFile(HISTORY_PATH, 'utf8');
    const parsed = JSON.parse(content ?? '[]') as HistoryPoint[];
    return parsed.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
      await fs.writeFile(HISTORY_PATH, '[]', 'utf8');
      return [];
    }
    throw error;
  }
}

function shouldAppend(history: HistoryPoint[], now: Date): boolean {
  if (!history.length) return true;
  const last = history[history.length - 1];
  const lastTs = new Date(last.ts).getTime();
  if (!Number.isFinite(lastTs)) return true;
  return now.getTime() - lastTs >= MIN_INTERVAL_MS;
}

async function writeHistory(history: HistoryPoint[]): Promise<void> {
  const tmp = `${HISTORY_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(history, null, 2));
  await fs.rename(tmp, HISTORY_PATH);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && 'toString' in value) {
    const asString = (value as { toString(): string }).toString();
    const num = Number(asString);
    return Number.isFinite(num) ? num : null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

main();
