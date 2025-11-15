#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { build } from 'esbuild';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHECKPOINT_KEY = process.env.CHECKPOINT_KEY ?? 'ankr-payg';
const WINDOW_SIZE = readInt('WINDOW_SIZE', 10_000);
const HEAD_MARGIN = readInt('HEAD_MARGIN', 50_000);
const START_BLOCK_OVERRIDE = readInt('START_BLOCK');
const END_BLOCK_OVERRIDE = readInt('END_BLOCK');
const TMP_DIR = path.join(process.cwd(), '.tmp-indexer-plan');

async function main() {
  await mkdir(TMP_DIR, { recursive: true });
  const prisma = new PrismaClient();

  try {
    const [{ indexerConfig }] = await Promise.all([loadTsModule('indexer.config.ts')]);
    const rpcUrls = resolveRpcUrls(indexerConfig.rpc?.url);

    const startBlock = START_BLOCK_OVERRIDE ?? (await resolveStartBlock(prisma, indexerConfig.contracts.startBlock));
    const head = await fetchHead(rpcUrls[0]);
    const safeHead = Math.max(startBlock, head - HEAD_MARGIN);
    const targetEnd = Math.max(startBlock, Math.min(END_BLOCK_OVERRIDE ?? safeHead, safeHead));
    const windows = buildWindows(startBlock, targetEnd, WINDOW_SIZE);

    const plan = {
      ok: true,
      checkpointKey: CHECKPOINT_KEY,
      startBlock,
      head,
      headMargin: HEAD_MARGIN,
      targetEnd,
      windowSize: WINDOW_SIZE,
      windows,
      windowsCount: windows.length,
      rpc: rpcUrls,
      ts: new Date().toISOString(),
    };

    console.log(JSON.stringify(plan, null, 2));
  } finally {
    await prisma.$disconnect().catch(() => {});
    await rm(TMP_DIR, { recursive: true, force: true });
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
  if (!Number.isFinite(start) || !Number.isFinite(end) || size <= 0) return [];
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
    throw new Error('FLARE_RPC_URLS is required for plan verification');
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

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, phase: 'plan', message: error?.message ?? String(error) }));
  process.exitCode = 1;
});
