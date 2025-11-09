import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

type HistoryPoint = {
  ts: string;
  tvlUsd: number;
  poolCount: number;
};

type HistoryMeta = {
  tvlUsd24hAgo: number | null;
  poolCount24hAgo: number | null;
  deltaTvlUsd: number | null;
  deltaPoolCount: number | null;
  ts24hAgo: string | null;
};

type HistoryResponse = {
  ok: boolean;
  items: HistoryPoint[];
  meta: HistoryMeta;
};

const HISTORY_PATH = path.join(process.cwd(), 'public', 'demo.history.json');
const WINDOW_MIN_MS = 20 * 60 * 60 * 1000;
const WINDOW_MAX_MS = 28 * 60 * 60 * 1000;
const CACHE_HEADER = 'public, max-age=60, s-maxage=60, stale-while-revalidate=120';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HistoryResponse | { ok: false; reason: string }>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, reason: 'method_not_allowed' });
  }

  try {
    const history = await readHistory();
    const meta = buildMeta(history);
    res.setHeader('Cache-Control', CACHE_HEADER);
    return res.status(200).json({ ok: true, items: history, meta });
  } catch (error) {
    console.error('[demo/history] failed to read history', error);
    return res.status(500).json({ ok: false, reason: 'history_unavailable' });
  }
}

async function readHistory(): Promise<HistoryPoint[]> {
  try {
    const payload = await fs.readFile(HISTORY_PATH, 'utf8');
    const parsed: HistoryPoint[] = JSON.parse(payload ?? '[]');
    return parsed
      .filter((entry) => entry && entry.ts)
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function buildMeta(history: HistoryPoint[]): HistoryMeta {
  if (!history.length) {
    return emptyMeta();
  }
  const latest = history[history.length - 1];
  const latestTs = new Date(latest.ts).getTime();
  if (!Number.isFinite(latestTs)) {
    return emptyMeta();
  }

  const windowStart = latestTs - WINDOW_MAX_MS;
  const windowEnd = latestTs - WINDOW_MIN_MS;

  for (let i = history.length - 2; i >= 0; i -= 1) {
    const candidate = history[i];
    const ts = new Date(candidate.ts).getTime();
    if (!Number.isFinite(ts)) continue;
    if (ts < windowStart) break;
    if (ts <= windowEnd) {
      return {
        tvlUsd24hAgo: candidate.tvlUsd,
        poolCount24hAgo: candidate.poolCount,
        deltaTvlUsd: latest.tvlUsd - candidate.tvlUsd,
        deltaPoolCount: latest.poolCount - candidate.poolCount,
        ts24hAgo: candidate.ts,
      };
    }
  }

  return emptyMeta();
}

function emptyMeta(): HistoryMeta {
  return {
    tvlUsd24hAgo: null,
    poolCount24hAgo: null,
    deltaTvlUsd: null,
    deltaPoolCount: null,
    ts24hAgo: null,
  };
}
