#!/usr/bin/env tsx

/**
 * LiquiLab Indexer Follower (hourly tail)
 *
 * Respects per-factory start blocks when no checkpoint exists,
 * but defaults to checkpoint resume otherwise.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { IndexerCore } from '../src/indexer/indexerCore';
import { indexerConfig } from '../indexer.config';
import {
  chooseStart,
  createRpcClient,
  loadStartBlocks,
  sanitizeRpcUrl,
  type StartReason,
} from './lib/indexer-util';

interface CliOptions {
  factory: 'enosys' | 'sparkdex' | 'all';
  fromBlock?: number;
  reset: boolean;
  factoryProvided: boolean;
  rps?: number;
  concurrency?: number;
  blockWindow?: number;
}

interface StartLogPayload {
  mode: 'backfill' | 'follower';
  factory: string;
  startSelected: number;
  reason: StartReason;
  tokenIds?: string[];
  rpcBase: string;
  streams: string[];
  chosenChunk: number;
  factoryStarts?: Record<string, number>;
  rps: number;
  concurrency: number;
  blockWindow: number;
  allowlistActive: boolean;
}

const PROGRESS_PATH = path.join(process.cwd(), 'data/indexer.progress.json');

function parseArgs(rawArgs: string[]): CliOptions {
  let factory: 'enosys' | 'sparkdex' | 'all' = 'all';
  let fromBlock: number | undefined;
  let reset = false;
  let factoryProvided = false;
  let rps: number | undefined;
  let concurrency: number | undefined;
  let blockWindow: number | undefined;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg === '--reset') {
      reset = true;
      continue;
    }

    if (arg === '--factory' && i + 1 < rawArgs.length) {
      factory = normalizeFactory(rawArgs[++i]);
      factoryProvided = true;
      continue;
    }
    if (arg.startsWith('--factory=')) {
      factory = normalizeFactory(arg.split('=')[1]);
      factoryProvided = true;
      continue;
    }

    if (arg === '--from' && i + 1 < rawArgs.length) {
      fromBlock = parseInt(rawArgs[++i], 10);
      continue;
    }
    if (arg.startsWith('--from=')) {
      fromBlock = parseInt(arg.split('=')[1], 10);
      continue;
    }

    if (arg === '--rps' && i + 1 < rawArgs.length) {
      const parsed = parseInt(rawArgs[++i], 10);
      if (!Number.isNaN(parsed)) rps = parsed;
      continue;
    }
    if (arg.startsWith('--rps=')) {
      const parsed = parseInt(arg.split('=')[1], 10);
      if (!Number.isNaN(parsed)) rps = parsed;
      continue;
    }

    if (arg === '--concurrency' && i + 1 < rawArgs.length) {
      const parsed = parseInt(rawArgs[++i], 10);
      if (!Number.isNaN(parsed)) concurrency = parsed;
      continue;
    }
    if (arg.startsWith('--concurrency=')) {
      const parsed = parseInt(arg.split('=')[1], 10);
      if (!Number.isNaN(parsed)) concurrency = parsed;
      continue;
    }

    if (arg === '--blockWindow' && i + 1 < rawArgs.length) {
      const parsed = parseInt(rawArgs[++i], 10);
      if (!Number.isNaN(parsed)) blockWindow = parsed;
      continue;
    }
    if (arg.startsWith('--blockWindow=')) {
      const parsed = parseInt(arg.split('=')[1], 10);
      if (!Number.isNaN(parsed)) blockWindow = parsed;
      continue;
    }
  }

  return {
    factory,
    fromBlock: Number.isFinite(fromBlock ?? NaN) ? fromBlock : undefined,
    reset,
    factoryProvided,
    rps,
    concurrency,
    blockWindow,
  };
}

function normalizeFactory(value?: string): 'enosys' | 'sparkdex' | 'all' {
  switch ((value ?? '').toLowerCase()) {
    case 'enosys':
      return 'enosys';
    case 'sparkdex':
      return 'sparkdex';
    default:
      return 'all';
  }
}

async function writeStartProgress(payload: StartLogPayload): Promise<void> {
  const body = {
    phase: 'start',
    updatedAt: new Date().toISOString(),
    ...payload,
  };
  await fs.writeFile(PROGRESS_PATH, JSON.stringify(body, null, 2), 'utf8');
}

function resolveFactoryStart(
  factory: 'enosys' | 'sparkdex' | 'all',
  startBlocks: Record<string, number>,
  fallback: number
): number {
  if (factory === 'all') {
    const values = Object.values(startBlocks).filter(
      (v) => typeof v === 'number' && Number.isFinite(v)
    );
    return values.length > 0 ? Math.min(...values) : fallback;
  }

  const candidate = startBlocks[factory];
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : fallback;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         LIQUI BLOCKCHAIN INDEXER - FOLLOWER MODE              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📡 Following blockchain head...');
  console.log(`   Poll interval: ${indexerConfig.follower.pollIntervalMs / 1000}s`);
  console.log(`   Confirmation blocks: ${indexerConfig.follower.confirmationBlocks}`);
  console.log('');

  const indexer = new IndexerCore();
  createRpcClient(); // ensures viem transport warm (timestamps cached elsewhere if needed)

  const startBlocks = await loadStartBlocks();
  const fallbackStart = indexerConfig.contracts.startBlock;
  const baseFactoryStart = resolveFactoryStart(options.factory, startBlocks, fallbackStart);
  const factoryTargets = options.factoryProvided
    ? (options.factory === 'all' ? ['enosys', 'sparkdex'] : [options.factory])
    : [];
  const factoryStartMap: Record<string, number> = {};
  for (const target of factoryTargets) {
    factoryStartMap[target] = startBlocks[target] ?? fallbackStart;
  }

  const status = await indexer.getStatus('global');
  const checkpoint = options.reset ? null : status.checkpoint;

  const startChoice = await chooseStart({
    cliFrom: options.fromBlock,
    factory: options.factory,
    tokenIds: [],
    startBlocks,
    checkpoint,
    reset: options.reset,
    fallbackStart,
    factoryStartOverride: baseFactoryStart,
  });

  const sanitizedRpc = sanitizeRpcUrl(indexerConfig.rpc.url);
  const streams = options.factoryProvided ? ['nfpm', 'factories', 'pools'] : ['nfpm'];
  let poolCount: number | undefined;
  if (options.factoryProvided) {
    try {
      poolCount = (await indexer.getKnownPools()).length;
    } catch (error) {
      console.warn('[follower] Unable to load pool registry for log payload:', error);
    }
  }
  const startLog: StartLogPayload = {
    mode: 'follower',
    factory: options.factory,
    startSelected: startChoice.start,
    reason: startChoice.reason,
    rpcBase: sanitizedRpc,
    streams,
    chosenChunk: indexerConfig.rpc.batchSize,
    factoryStarts: options.factoryProvided ? factoryStartMap : undefined,
    poolCount,
    rps: options.rps || indexerConfig.rpc.rps,
    concurrency: options.concurrency || indexerConfig.rpc.concurrency,
    blockWindow: options.blockWindow || indexerConfig.rpc.blockWindow,
    allowlistActive: indexerConfig.allowlist?.enabled ?? false,
  };

  console.log(JSON.stringify(startLog));
  await writeStartProgress(startLog);

  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;
  let nextFromBlock: number | undefined =
    startChoice.reason === 'checkpoint' ? undefined : startChoice.start;
  const factoryNextFrom: Record<string, number | undefined> = {};
  for (const target of factoryTargets) {
    factoryNextFrom[target] = options.fromBlock ?? factoryStartMap[target];
  }

  process.on('SIGINT', async () => {
    console.log('');
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    await indexer.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('');
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    await indexer.close();
    process.exit(0);
  });

  while (true) {
    try {
      if (options.factoryProvided) {
        for (const target of factoryTargets as ('enosys' | 'sparkdex')[]) {
          const factoryResult = await indexer.indexFactories({
            factory: target,
            fromBlock: factoryNextFrom[target],
          });
          factoryNextFrom[target] = undefined;

          if (factoryResult.eventsDecoded > 0) {
            console.log(
              `[${new Date().toISOString()}] [factory:${target}] ✅ ${factoryResult.eventsDecoded} events (${factoryResult.blocksScanned.toLocaleString()} blocks)`
            );
          }
        }
      }

      const currentStatus = await indexer.getStatus('global');
      const needsSync = currentStatus.blocksBehind > 0 || nextFromBlock !== undefined;

      if (needsSync) {
        const result = await indexer.index({
          checkpointKey: 'global',
          fromBlock: nextFromBlock,
        });
        nextFromBlock = undefined;

        if (result.eventsDecoded > 0) {
          console.log(
            `[${new Date().toISOString()}] ✅ Synced ${result.blocksScanned} blocks, ${result.eventsDecoded} events in ${Math.round(
              result.elapsedMs / 1000
            )}s`
          );
        }

        consecutiveErrors = 0;
      } else {
        const checkpointInfo =
          currentStatus.checkpoint ?? startChoice.start ?? indexerConfig.contracts.startBlock;
        console.log(`[${new Date().toISOString()}] ✓ Up to date at block ${checkpointInfo}`);
      }

      if (options.factoryProvided) {
        const poolResult = await indexer.indexPoolEvents({
          checkpointKey: 'all',
        });
        if (poolResult.eventsDecoded > 0) {
          console.log(
            `[${new Date().toISOString()}] [pools] ✅ ${poolResult.eventsDecoded} events (${poolResult.blocksScanned.toLocaleString()} pool-blocks)`
          );
        }
      }

      await sleep(indexerConfig.follower.pollIntervalMs);
    } catch (error) {
      consecutiveErrors++;
      console.error(
        `[${new Date().toISOString()}] ❌ Sync error (${consecutiveErrors}/${maxConsecutiveErrors}):`,
        error
      );

      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error('');
        console.error(`❌ Too many consecutive errors (${maxConsecutiveErrors}), exiting...`);
        await indexer.close();
        process.exit(1);
      }

      const backoffMs = Math.min(
        indexerConfig.follower.restartDelayMs * consecutiveErrors,
        30000
      );
      console.log(`⏳ Waiting ${backoffMs / 1000}s before retry...`);
      await sleep(backoffMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
