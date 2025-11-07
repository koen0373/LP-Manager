import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'node:fs/promises';
import path from 'node:path';

const PROGRESS_PATH = path.join(process.cwd(), 'data', 'indexer.progress.json');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    const raw = await fs.readFile(PROGRESS_PATH, 'utf8');
    const data = JSON.parse(raw);
    res.status(200).json(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      res.status(200).json({ phase: 'idle', updatedAt: new Date().toISOString() });
      return;
    }
    res.status(500).json({ ok: false, error: String(error) });
  }
}
