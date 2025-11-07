#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PROGRESS_PATH = path.join(ROOT, 'data/indexer.progress.json');
const TARGETS = [
  { label: 'nfpm', file: path.join(ROOT, 'data/raw/nfpm.ndjson') },
  { label: 'pool_state', file: path.join(ROOT, 'data/raw/pool_state.ndjson') },
  { label: 'pools', file: path.join(ROOT, 'data/core/pools.ndjson') },
];

async function readProgress() {
  try {
    const raw = await fs.readFile(PROGRESS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function countLines(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    if (!raw) return 0;
    return raw.trim().length === 0 ? 0 : raw.trim().split(/\r?\n/).length;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return 0;
    }
    throw error;
  }
}

async function main() {
  const progress = await readProgress();
  if (progress) {
    const { startSelected, reason, factory, mode } = progress;
    console.log(
      `[indexer-smoke] mode=${mode ?? 'unknown'} factory=${factory ?? 'all'} start=${startSelected ?? 'n/a'} reason=${reason ?? 'n/a'}`
    );
  } else {
    console.log('[indexer-smoke] progress file not found; run a backfill/follower first.');
  }

  for (const target of TARGETS) {
    const count = await countLines(target.file);
    console.log(`[indexer-smoke] ${target.label}: ${count} line(s)`);
  }
}

main().catch((error) => {
  console.error('[indexer-smoke] unexpected error:', error);
  process.exitCode = 0;
});
