#!/usr/bin/env node

import { build } from 'esbuild';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

try {
  await import('tsconfig-paths/register');
} catch {
  // ignore – optional helper
}

const TMP_DIR = path.join(process.cwd(), '.tmp-indexer-continuous');

function setupSignalHandlers(onSignal) {
  const handler = (signal) => onSignal(signal);
  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
  return () => {
    process.off('SIGINT', handler);
    process.off('SIGTERM', handler);
  };
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
    logLevel: 'silent',
  });

  const outfile = path.join(
    TMP_DIR,
    `${path.basename(entry).replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.mjs`
  );
  await writeFile(outfile, result.outputFiles[0].text, 'utf8');
  const mod = await import(pathToFileURL(outfile).href);
  await rm(outfile, { force: true });
  return mod;
}

export async function runContinuous(options = {}) {
  const intervalSec = Number(
    options.intervalSec ?? process.env.FOLLOW_INTERVAL_SEC ?? 30
  );
  const maxLoops = Number(options.maxLoops ?? process.env.MAX_LOOPS ?? 0);
  const reset = options.reset ?? process.env.FOLLOW_RESET === 'true';
  const includePools = options.includePools ?? process.env.FOLLOW_INCLUDE_POOLS === 'true';
  const factoryEnv = (process.env.FOLLOW_FACTORIES || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value === 'enosys' || value === 'sparkdex');
  const factoryTargets = options.factories ?? factoryEnv;
  const quiet = Boolean(options.quiet);
  const maxErrors = Number(process.env.FOLLOW_MAX_ERRORS ?? 5);

  await mkdir(TMP_DIR, { recursive: true });

  const [{ IndexerCore }, { indexerConfig }, indexerUtil] = await Promise.all([
    loadTsModule('src/indexer/indexerCore.ts'),
    loadTsModule('indexer.config.ts'),
    loadTsModule('scripts/lib/indexer-util.ts'),
  ]);

  const { loadStartBlocks, chooseStart, sanitizeRpcUrl, createRpcClient } = indexerUtil;
  const indexer = new IndexerCore();
  createRpcClient();

  const startBlocks = await loadStartBlocks();
  const fallbackStart = indexerConfig.contracts.startBlock;
  const status = await indexer.getStatus('global');

  const startChoice = await chooseStart({
    factory: factoryTargets.length === 1 ? (factoryTargets[0] === 'sparkdex' ? 'sparkdex' : 'enosys') : 'all',
    startBlocks,
    checkpoint: reset ? null : status.checkpoint,
    reset,
    fallbackStart,
  });

  let nextFromBlock =
    startChoice.reason === 'checkpoint' ? undefined : startChoice.start;
  const factoryNextFrom = {};
  for (const target of factoryTargets) {
    factoryNextFrom[target] = startBlocks[target] ?? fallbackStart;
  }

  const stopState = { requested: false };
  const teardownSignals = setupSignalHandlers((signal) => {
    if (!stopState.requested && !quiet) {
      console.log(`[${new Date().toISOString()}] ${signal} received, finishing current loop...`);
    }
    stopState.requested = true;
  });

  if (!quiet) {
    console.log(
      JSON.stringify({
        mode: 'continuous',
        intervalSec,
        maxLoops: maxLoops || 'infinite',
        rpc: sanitizeRpcUrl(indexerConfig.rpc.url),
        includePools,
        factories: factoryTargets,
      })
    );
  }

  let loops = 0;
  let consecutiveErrors = 0;

  try {
    while (!stopState.requested && (maxLoops <= 0 || loops < maxLoops)) {
      loops += 1;
      try {
        if (factoryTargets.length > 0) {
          for (const target of factoryTargets) {
            const result = await indexer.indexFactories({
              factory: target,
              fromBlock: factoryNextFrom[target],
            });
            factoryNextFrom[target] = undefined;
            if (!quiet && result.eventsDecoded > 0) {
              console.log(
                `[${new Date().toISOString()}] [factory:${target}] ✅ ${result.eventsDecoded} events`
              );
            }
          }
        }

        const followResult = await indexer.index({
          checkpointKey: 'global',
          fromBlock: nextFromBlock,
        });
        nextFromBlock = undefined;

        if (!quiet) {
          console.log(
            `[${new Date().toISOString()}] ✅ Synced ${followResult.blocksScanned} blocks (${followResult.eventsDecoded} events)`
          );
        }

        if (includePools) {
          const poolResult = await indexer.indexPoolEvents({
            checkpointKey: 'all',
          });
          if (!quiet && poolResult.eventsDecoded > 0) {
            console.log(
              `[${new Date().toISOString()}] [pools] ✅ ${poolResult.eventsDecoded} events`
            );
          }
        }

        consecutiveErrors = 0;
      } catch (error) {
        consecutiveErrors += 1;
        console.error(
          `[${new Date().toISOString()}] ❌ Iteration error (${consecutiveErrors}/${maxErrors}):`,
          error
        );
        if (consecutiveErrors >= maxErrors) {
          throw error;
        }
        await sleep(Math.min(intervalSec * 1000, 30_000));
      }

      if (stopState.requested || (maxLoops > 0 && loops >= maxLoops)) {
        break;
      }
      await sleep(intervalSec * 1000);
    }

    return { loops };
  } finally {
    teardownSignals();
    await indexer.close().catch(() => {});
    await rm(TMP_DIR, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runContinuous()
    .then((result) => {
      console.log(JSON.stringify({ ok: true, loops: result.loops }));
      process.exit(0);
    })
    .catch((error) => {
      console.error(JSON.stringify({ ok: false, error: error?.message ?? String(error) }));
      process.exit(1);
    });
}
