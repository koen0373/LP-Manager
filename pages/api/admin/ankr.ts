import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'ankr_costs.json');
const CACHE_MS = 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 60;

type CostRecord = {
  ts: string;
  dayCostUsd: number;
  monthCostUsd: number;
  totalCalls: number;
  lastUpdated: string;
};

type CacheFile = {
  latest: CostRecord;
  history: CostRecord[];
};

const EMPTY_RECORD: CostRecord = {
  ts: '',
  dayCostUsd: 0,
  monthCostUsd: 0,
  totalCalls: 0,
  lastUpdated: '',
};

async function readCache(): Promise<CacheFile | null> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'latest' in parsed) {
      return parsed as CacheFile;
    }
    if (parsed && typeof parsed === 'object' && 'ts' in parsed) {
      return { latest: parsed as CostRecord, history: [] };
    }
  } catch {
    // ignore
  }
  return null;
}

async function writeCache(cache: CacheFile) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

async function fetchBilling(apiKey: string) {
  const response = await fetch(`https://rpc.ankr.com/billing?apiKey=${encodeURIComponent(apiKey)}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch billing data');
  }
  return response.json();
}

const maskKey = (key: string) => (key.length > 6 ? `••••${key.slice(-6)}` : key);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = process.env.ANKR_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ ok: false, reason: 'no data' });
  }

  const forceRefresh = req.query.refresh === '1';
  const cache = await readCache();
  const now = Date.now();

  if (!forceRefresh && cache?.latest?.ts) {
    const age = now - Date.parse(cache.latest.ts);
    if (!Number.isNaN(age) && age < CACHE_MS) {
      return res.status(200).json({
        ok: true,
        data: cache.latest,
        history: cache.history ?? [],
        apiKeyTail: maskKey(apiKey),
        stale: false,
      });
    }
  }

  try {
    const usage = await fetchBilling(apiKey);
    const ts = new Date().toISOString();
    const record: CostRecord = {
      ts,
      dayCostUsd: Number(usage.dayCostUsd ?? usage.day ?? 0),
      monthCostUsd: Number(usage.monthCostUsd ?? usage.month ?? 0),
      totalCalls: Number(usage.totalCalls ?? usage.calls ?? 0),
      lastUpdated: ts,
    };
    const history = [record, ...(cache?.history ?? [])].slice(0, HISTORY_LIMIT);
    await writeCache({ latest: record, history });
    return res.status(200).json({ ok: true, data: record, history, apiKeyTail: maskKey(apiKey), stale: false });
  } catch (error) {
    console.error('[ankr admin api] failed to refresh billing data', error);
    if (cache?.latest) {
      return res.status(200).json({
        ok: true,
        data: cache.latest,
        history: cache.history ?? [],
        apiKeyTail: maskKey(apiKey),
        stale: true,
      });
    }
    return res.status(200).json({ ok: false, reason: 'no data' });
  }
}
