#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { build } from 'esbuild';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const CHECKPOINT_KEY = process.env.CHECKPOINT_KEY ?? 'ankr-payg';
const WINDOW_SIZE = readInt('WINDOW_SIZE', 10_000);
const HEAD_MARGIN = readInt('HEAD_MARGIN', 50_000);
const MAX_RETRIES = Math.max(readInt('MAX_RETRIES', 3), 1);
const BACKOFF_BASE_MS = readInt('BACKOFF_MS', 5_000);
const BACKOFF_MAX_MS = readInt('BACKOFF_MAX_MS', 20_000);
const START_BLOCK_OVERRIDE = readInt('START_BLOCK');
const END_BLOCK_OVERRIDE = readInt('END_BLOCK');
const TMP_DIR = path.join(process.cwd(), '.tmp-indexer-backfill');

async function main() {
  ensureDbEnabled();
  await mkdir(TMP_DIR, { recursive: true });

  try {
    const [{ indexerConfig }] = await Promise.all([loadTsModule('indexer.config.ts')]);
    const rpcUrls = resolveRpcUrls(indexerConfig.rpc?.url);
    const prisma = await createPrisma();
    const startBlock = await (async () => {
      try {
        return (
          START_BLOCK_OVERRIDE ?? (await resolveStartBlock(prisma, indexerConfig.contracts.startBlock))
        );
      } finally {
        await prisma.$disconnect().catch(() => {});
      }
    })();

    const head = await fetchHead(rpcUrls[0]);
    const safeHead = Math.max(startBlock, head - HEAD_MARGIN);
    if (safeHead <= startBlock) {
      console.log(
        JSON.stringify({ ok: true, note: 'Already at head margin', startBlock, head, headMargin: HEAD_MARGIN })
      );
      return;
    }

    const targetEnd = Math.max(startBlock, Math.min(END_BLOCK_OVERRIDE ?? safeHead, safeHead));
    const windows = buildWindows(startBlock, targetEnd, WINDOW_SIZE);

    const planLog = {
      ok: true,
      checkpointKey: CHECKPOINT_KEY,
      rpcPrimary: rpcUrls[0],
      windowSize: WINDOW_SIZE,
      windows: windows.length,
      startBlock,
      targetEnd,
      head,
      headMargin: HEAD_MARGIN,
      maxRetries: MAX_RETRIES,
    };
    console.log(JSON.stringify({ ...planLog, phase: 'plan' }));

    if (windows.length === 0) {
      console.log(JSON.stringify({ ...planLog, phase: 'noop' }));
      return;
    }

    const { IndexerCore } = await loadTsModule('src/indexer/indexerCore.ts');
    const core = new IndexerCore();

    try {
      for (const range of windows) {
        await runWindow(core, range);
      }
    } finally {
      await core.close();
    }

    console.log(JSON.stringify({ ...planLog, phase: 'complete', windowsProcessed: windows.length }));
  } finally {
    await rm(TMP_DIR, { recursive: true, force: true });
  }
}

async function runWindow(core, range) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        JSON.stringify({
          ok: true,
          phase: 'window:start',
          checkpointKey: CHECKPOINT_KEY,
          window: range,
          attempt,
          maxRetries: MAX_RETRIES,
          ts: new Date().toISOString(),
        })
      );
      const result = await core.index({
        fromBlock: range.from,
        toBlock: range.to,
        checkpointKey: CHECKPOINT_KEY,
      });
      const blocks = range.to - range.from + 1;
      const seconds = Math.max(result.elapsedMs / 1000, 0.001);
      const rate = Number((blocks / seconds).toFixed(2));

      console.log(
        JSON.stringify({
          ok: true,
          phase: 'window:complete',
          window: range,
          checkpointKey: CHECKPOINT_KEY,
          stats: {
            blocks,
            eventsWritten: result.eventsWritten,
            duplicates: result.duplicates,
            errors: result.errors,
            elapsedMs: result.elapsedMs,
            rate,
            checkpoint: range.to,
          },
          ts: new Date().toISOString(),
        })
      );
      return;
    } catch (error) {
      console.error(
        JSON.stringify({
          ok: false,
          phase: 'window:error',
          window: range,
          checkpointKey: CHECKPOINT_KEY,
          attempt,
          maxRetries: MAX_RETRIES,
          message: error?.message ?? String(error),
        })
      );
      if (attempt >= MAX_RETRIES) {
        throw error;
      }
      const waitMs = Math.min(BACKOFF_BASE_MS * attempt, BACKOFF_MAX_MS);
      await sleep(waitMs);
    }
  }
}

async function resolveStartBlock(prisma, defaultStart) {
  const checkpoint = await prisma.syncCheckpoint.findUnique({
    where: {
      source_key: {
        source: 'NPM',
        key: CHECKPOINT_KEY,
      },
    },
  });
  if (checkpoint?.lastBlock) {
    return checkpoint.lastBlock + 1;
  }
  return defaultStart;
}

function buildWindows(start, end, size) {
  if (end < start) return [];
  const windows = [];
  let cursor = start;
  while (cursor <= end) {
    const upper = Math.min(cursor + size - 1, end);
    windows.push({ from: cursor, to: upper });
    cursor = upper + 1;
  }
  return windows;
}

function readInt(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function resolveRpcUrls(fallbackUrl = '') {
  const envUrls = (process.env.FLARE_RPC_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  const extra = (process.env.ANKR_ENDPOINT || '').trim();
  if (extra && !envUrls.includes(extra)) {
    envUrls.unshift(extra);
  }
  if (envUrls.length === 0 && fallbackUrl) {
    envUrls.push(fallbackUrl.trim());
  }
  const prioritized = prioritizeAnkr(envUrls);
  if (prioritized.length === 0) {
    throw new Error('FLARE_RPC_URLS is required for backfill');
  }
  process.env.FLARE_RPC_URLS = prioritized.join(',');
  return prioritized;
}

function prioritizeAnkr(urls) {
  if (urls.length <= 1) return urls;
  const index = urls.findIndex((url) => /ankr/i.test(url));
  if (index > 0) {
    const [ankrUrl] = urls.splice(index, 1);
    urls.unshift(ankrUrl);
  }
  return urls;
}

async function fetchHead(rpcUrl) {
  const payload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'eth_blockNumber',
    params: [],
  };
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch head block (${response.status})`);
  }
  const body = await response.json();
  if (!body?.result) {
    throw new Error('RPC response missing result');
  }
  return Number.parseInt(body.result, 16);
}

async function loadTsModule(entry) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    target: 'node20',
    packages: 'external',
    absWorkingDir: process.cwd(),
    outfile: `${path.basename(entry)}.mjs`,
    logLevel: 'silent',
  });
  const js = result.outputFiles[0];
  const outfile = path.join(
    TMP_DIR,
    `${path.basename(entry).replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.mjs`
  );
  await writeFile(outfile, js.text, 'utf8');
  const mod = await import(pathToFileURL(outfile).href);
  await rm(outfile, { force: true });
  return mod;
}

async function createPrisma() {
  const prisma = new PrismaClient();
  return prisma;
}

function ensureDbEnabled() {
  if (process.env.DB_DISABLE === 'true') {
    throw new Error('DB_DISABLE must be false for backfill runs');
  }
}

main().catch(async (error) => {
  console.error(JSON.stringify({ ok: false, phase: 'fatal', message: error?.message ?? String(error) }));
  process.exitCode = 1;
});
