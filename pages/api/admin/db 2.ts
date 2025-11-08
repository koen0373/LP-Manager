import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = globalThis.__ll_prisma ?? new PrismaClient();
if (!globalThis.__ll_prisma) (globalThis as any).__ll_prisma = prisma;

type Json = any;

const isSafeIdent = (s: string) => /^[a-zA-Z0-9_]+$/.test(s);

async function listTables(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Json[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC
  `;
  return rows.map((r: any) => r.table_name as string);
}

async function getTextColumns(table: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Json[]>`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
  `;
  const likeTypes = new Set(['text','character varying','varchar','citext','uuid']);
  return rows.filter((r: any) => likeTypes.has(r.data_type)).map((r: any) => r.column_name as string);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const tables = await listTables();

    const { table, limit: l, offset: o, q } = req.query as Record<string, string | undefined>;
    const limit = Math.min(Math.max(Number(l ?? 50), 1), 200);
    const offset = Math.max(Number(o ?? 0), 0);

    if (!table) {
      return res.status(200).json({ ok: true, tables, hint: 'Provide ?table=<name>&limit=50&offset=0' });
    }

    if (!isSafeIdent(table) || !tables.includes(table)) {
      return res.status(400).json({ ok: false, reason: 'invalid table' });
    }

    // Count rows
    const countRows = await prisma.$queryRawUnsafe<Json[]>(`SELECT COUNT(*)::bigint AS c FROM "public"."${table}"`);
    const total = Number(countRows?.[0]?.c ?? 0);

    // Optional search across text-ish columns (first up to 5 columns)
    let whereClause = '';
    let params: any[] = [];
    if (q && q.trim()) {
      const cols = (await getTextColumns(table)).slice(0, 5);
      if (cols.length > 0) {
        const ors = cols.map((c, i) => `"${c}" ILIKE $${i + 1}`).join(' OR ');
        whereClause = `WHERE ${ors}`;
        params = cols.map(() => `%${q}%`);
      }
    }

    // Fetch rows; order by first column desc if possible to keep results stable
    const firstColRows = await prisma.$queryRawUnsafe<Json[]>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='${table}'
      ORDER BY ordinal_position ASC LIMIT 1
    `);
    const firstCol = firstColRows?.[0]?.column_name ?? null;
    const order = firstCol ? `ORDER BY "${firstCol}" DESC` : '';

    const sql = `
      SELECT * FROM "public"."${table}"
      ${whereClause} ${order}
      LIMIT ${limit} OFFSET ${offset}
    `;
    const rows = await prisma.$queryRawUnsafe<Json[]>(sql, ...params);

    return res.status(200).json({
      ok: true,
      table,
      tables,
      total,
      limit,
      offset,
      q: q ?? '',
      columns: rows.length ? Object.keys(rows[0]) : [],
      rows,
      lastUpdatedIso: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[admin/db] error', err);
    return res.status(500).json({ ok: false, reason: err?.message ?? 'server error' });
  }
}
