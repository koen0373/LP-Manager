import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Minimale healthcheck – app leeft
  const result: { ok: boolean; app: string; db?: string; dbError?: string } = { ok: true, app: 'ok' };

  // Optionele DB-check: probeert Prisma te importeren en een ping te doen
  try {
    // Let op: pad is afhankelijk van jouw project; '@/lib/data/db' is bij jou aanwezig.
    const { db } = await import('@/lib/data/db');
    try {
      await db.$queryRaw`SELECT 1`;
      result.db = 'ok';
    } catch (e: unknown) {
      const error = e as Error;
      result.db = 'error';
      result.dbError = error?.message ?? String(e);
    }
  } catch {
    // Geen Prisma of ander pad? Dan slaan we DB-check over.
    result.db = 'skipped';
  }

  res.status(result.db === 'error' ? 500 : 200).json(result);
}
