import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const MIN_PER = 10;
const MAX_PER = 200;
const DEFAULT_PER = 50;
const DEFAULT_PAGE = 1;

const sources = ['analytics_position_flat', 'analytics_position'] as const;

type PositionRow = {
  token_id: string;
  owner_address: string | null;
  pool_address: string | null;
  first_block: number | null;
  last_block: number | null;
};

const isMissingViewError = (err: unknown) =>
  typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '42P01';

const normalizeAddress = (value?: string | null) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return ADDRESS_REGEX.test(trimmed) ? trimmed.toLowerCase() : '';
};

const normalizeTokenId = (value?: string | null) => {
  if (!value) return '';
  const trimmed = value.trim();
  return trimmed ? trimmed : '';
};

const buildWhereClause = (filters: Prisma.Sql[]) =>
  filters.length ? Prisma.sql`WHERE ${Prisma.join(filters, Prisma.sql` AND `)}` : Prisma.empty;

async function queryTable(
  tableName: string,
  whereClause: Prisma.Sql,
  orderClause: Prisma.Sql,
  limit: number,
  offset: number,
) {
  const table = Prisma.raw(tableName);
  const items = await prisma.$queryRaw<PositionRow[]>(Prisma.sql`
    SELECT token_id, owner_address, pool_address, first_block, last_block
    FROM ${table}
    ${whereClause}
    ${orderClause}
    LIMIT ${limit} OFFSET ${offset}
  `);

  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>(
    Prisma.sql`SELECT COUNT(*)::bigint AS count FROM ${table} ${whereClause}`,
  );

  return { items, total: Number(count ?? 0) };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req;

  const pageParam = Number(query.page);
  const perParam = Number(query.per);

  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : DEFAULT_PAGE;
  let per = Number.isFinite(perParam) && perParam > 0 ? Math.floor(perParam) : DEFAULT_PER;
  per = Math.max(MIN_PER, Math.min(MAX_PER, per));
  const offset = (page - 1) * per;

  const owner = normalizeAddress(query.owner as string);
  const pool = normalizeAddress(query.pool as string);
  const search = normalizeTokenId(query.search as string);

  if (query.owner && !owner) {
    return res.status(400).json({ error: 'Invalid owner address' });
  }
  if (query.pool && !pool) {
    return res.status(400).json({ error: 'Invalid pool address' });
  }

  const filters: Prisma.Sql[] = [];
  if (owner) filters.push(Prisma.sql`COALESCE(LOWER(owner_address), '') = ${owner}`);
  if (pool) filters.push(Prisma.sql`COALESCE(LOWER(pool_address), '') = ${pool}`);
  if (search) filters.push(Prisma.sql`token_id = ${search}`);

  const whereClause = buildWhereClause(filters);
  const orderClause = Prisma.sql`ORDER BY last_block DESC NULLS LAST, token_id ASC`;

  for (const source of sources) {
    try {
      const { items, total } = await queryTable(source, whereClause, orderClause, per, offset);
      res.setHeader('X-Total-Count', total.toString());
      return res.status(200).json({ items, page, per, total });
    } catch (err) {
      if (!isMissingViewError(err) || source === sources[sources.length - 1]) {
        console.error('[analytics positions] failed', err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      // else loop continues to fallback table
    }
  }

  return res.status(500).json({ error: 'Internal Server Error' });
}
