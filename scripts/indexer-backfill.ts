#!/usr/bin/env tsx

/**
 * LiquiLab Indexer Backfill
 *
 * Deterministic start block selection with per-factory defaults,
 * token mint discovery, and checkpoint-aware resume logic.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { IndexerCore } from '../src/indexer/indexerCore';
import { indexerConfig } from '../indexer.config';
import {
  chooseStart,
  createRpcClient,
  findFirstTokenMint,
  loadStartBlocks,
  sanitizeRpcUrl,
  type StartReason,
} from './lib/indexer-util';

interface CliOptions {
  dryRun: boolean;
  tokenIds: string[];
  factory: 'enosys' | 'sparkdex' | 'all';
  fromBlock?: number;
  reset: boolean;
  chunk: number;
  rps: number;
  concurrency?: number;
  blockWindow?: number;
  costWeights?: string;
  streams: ('nfpm' | 'factories' | 'pools')[];
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
  poolCount?: number;
  rps: number;
  concurrency: number;
  blockWindow: number;
  allowlistActive: boolean;
}

const PROGRESS_PATH = path.join(process.cwd(), 'data/indexer.progress.json');

function parseArgs(rawArgs: string[]): CliOptions {
  const tokenIds = new Set<string>();
  let dryRun = false;
  let factory: 'enosys' | 'sparkdex' | 'all' = 'all';
  let fromBlock: number | undefined;
  let reset = false;
  let chunk = 1000;
  let rps = 5;
  let concurrency: number | undefined;
  let blockWindow: number | undefined;
  let costWeights: string | undefined;
  const streams = new Set<'nfpm' | 'factories' | 'pools'>(['nfpm']);

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg === '--dry' || arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--reset') {
      reset = true;
      continue;
    }

    if (arg === '--factory' && i + 1 < rawArgs.length) {
      factory = normalizeFactory(rawArgs[++i]);
      continue;
    }
    if (arg.startsWith('--factory=')) {
      factory = normalizeFactory(arg.split('=')[1]);
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

    if (arg === '--tokenIds' && i + 1 < rawArgs.length) {
      splitTokenIds(rawArgs[++i]).forEach((id) => tokenIds.add(id));
      continue;
    }
    if (arg.startsWith('--tokenIds=')) {
      splitTokenIds(arg.split('=')[1]).forEach((id) => tokenIds.add(id));
      continue;
    }

    if (arg === '--chunk' && i + 1 < rawArgs.length) {
      const parsed = parseInt(rawArgs[++i], 10);
      if (!Number.isNaN(parsed)) chunk = parsed;
      continue;
    }
    if (arg.startsWith('--chunk=')) {
      const parsed = parseInt(arg.split('=')[1], 10);
      if (!Number.isNaN(parsed)) chunk = parsed;
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

    if (arg === '--cost-weights' && i + 1 < rawArgs.length) {
      costWeights = rawArgs[++i];
      continue;
    }
    if (arg.startsWith('--cost-weights=')) {
      costWeights = arg.split('=')[1];
      continue;
    }

    if (arg === '--streams' && i + 1 < rawArgs.length) {
      streams.clear();
      splitStreams(rawArgs[++i]).forEach((stream) => streams.add(stream));
      continue;
    }
    if (arg.startsWith('--streams=')) {
      streams.clear();
      splitStreams(arg.split('=')[1]).forEach((stream) => streams.add(stream));
      continue;
    }

    if (/^\d+$/.test(arg)) {
      tokenIds.add(arg);
    }
  }

  return {
    dryRun,
    tokenIds: Array.from(tokenIds),
    factory,
    fromBlock: Number.isFinite(fromBlock ?? NaN) ? fromBlock : undefined,
    reset,
    chunk,
    rps,
    concurrency,
    blockWindow,
    costWeights,
    streams: Array.from(streams),
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

function splitTokenIds(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => /^\d+$/.test(part));
}

function splitStreams(value?: string): ('nfpm' | 'factories' | 'pools')[] {
  if (!value) return ['nfpm'];
  return value
    .split(',')
    .map((part) => part.trim())
    .map(normalizeStream)
    .filter((stream): stream is 'nfpm' | 'factories' | 'pools' => stream !== null);
}

function normalizeStream(value?: string): 'nfpm' | 'factories' | 'pools' | null {
  switch ((value ?? '').toLowerCase()) {
    case 'factories':
      return 'factories';
    case 'nfpm':
      return 'nfpm';
    case 'pools':
      return 'pools';
    case '':
      return null;
    default:
      return null;
  }
}

async function writeStartProgress(payload: StartLogPayload): Promise<void> {
  const body = {
    phase: 'start',
    updatedAt: new Date().toISOString(),
    ...payload,
  };
  // Ensure data directory exists
  const dir = path.dirname(PROGRESS_PATH);
  await fs.mkdir(dir, { recursive: true });
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
  console.log('║         LIQUI BLOCKCHAIN INDEXER - BACKFILL MODE              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No data will be written');
    console.log('');
  }

  const indexer = new IndexerCore();
  const client = createRpcClient();

  const startBlocks = await loadStartBlocks();
  const fallbackStart = indexerConfig.contracts.startBlock;
  const baseFactoryStart = resolveFactoryStart(options.factory, startBlocks, fallbackStart);
  const factoryTargets =
    options.factory === 'all' ? (['enosys', 'sparkdex'] as const) : ([options.factory] as const);
  const factoryStartMap: Record<string, number> = {};
  for (const target of factoryTargets) {
    factoryStartMap[target] = startBlocks[target] ?? fallbackStart;
  }

  const status = await indexer.getStatus('global');
  const checkpoint = options.reset ? null : status.checkpoint;

  const nfpmAddress = indexerConfig.contracts.npm;
  const boundMintLookup =
    options.tokenIds.length > 0
      ? (tokenId: string) =>
          findFirstTokenMint({
            client,
            nfpmAddress,
            tokenId,
            startBlock: baseFactoryStart,
            chunk: options.chunk,
            rps: options.rps,
          })
      : undefined;

  const startChoice = await chooseStart({
    cliFrom: options.fromBlock,
    factory: options.factory,
    tokenIds: options.tokenIds,
    startBlocks,
    checkpoint,
    reset: options.reset,
    findFirstTokenMint: boundMintLookup,
    fallbackStart,
    factoryStartOverride: baseFactoryStart,
  });

  const sanitizedRpc = sanitizeRpcUrl(indexerConfig.rpc.url);
  const runFactories = options.streams.includes('factories');
  const runNfpm = options.streams.includes('nfpm');
  const runPools = options.streams.includes('pools');
  let poolCount: number | undefined;
  if (runPools) {
    try {
      poolCount = (await indexer.getKnownPools()).length;
    } catch (error) {
      console.warn('[backfill] Unable to load pool registry for log payload:', error);
    }
  }
  const structuredLog: StartLogPayload = {
    mode: 'backfill',
    factory: options.factory,
    startSelected: startChoice.start,
    reason: startChoice.reason,
    tokenIds: options.tokenIds.length > 0 ? options.tokenIds : undefined,
    rpcBase: sanitizedRpc,
    streams: options.streams,
    chosenChunk: indexerConfig.rpc.batchSize,
    factoryStarts: runFactories ? factoryStartMap : undefined,
    poolCount,
    rps: options.rps || indexerConfig.rpc.rps,
    concurrency: options.concurrency || indexerConfig.rpc.concurrency,
    blockWindow: options.blockWindow || indexerConfig.rpc.blockWindow,
    allowlistActive: indexerConfig.allowlist?.enabled ?? false,
  };

  console.log(JSON.stringify(structuredLog));
  await writeStartProgress(structuredLog);

  try {
    if (runFactories) {
      for (const target of factoryTargets) {
        const requestedFrom = options.fromBlock ?? factoryStartMap[target];
        const factoryResult = await indexer.indexFactories({
          factory: target,
          fromBlock: requestedFrom,
          dryRun: options.dryRun,
        });

        if (factoryResult.eventsDecoded > 0) {
          console.log(
            `[factory:${target}] ✅ ${factoryResult.eventsDecoded} events (${factoryResult.blocksScanned.toLocaleString()} blocks)`
          );
        } else {
          console.log(
            `[factory:${target}] ✓ scanned ${factoryResult.blocksScanned.toLocaleString()} blocks (${factoryResult.logsFound} logs)`
          );
        }
      }
    }

    if (runNfpm) {
      if (options.tokenIds.length > 0) {
        console.log(
          `🎯 Backfilling ${options.tokenIds.length} tokenId(s): ${options.tokenIds.join(', ')}`
        );
        console.log('');

        for (const tokenId of options.tokenIds) {
          const checkpointKey = `tokenId:${tokenId}`;

          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`🔄 Backfilling tokenId: ${tokenId}`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');

          const result = await indexer.index({
            tokenIds: [tokenId],
            checkpointKey,
            dryRun: options.dryRun,
            fromBlock: startChoice.reason === 'checkpoint' ? undefined : startChoice.start,
          });

          console.log('');
          console.log(`✅ TokenId ${tokenId} complete:`);
          console.log(`   - Blocks scanned: ${result.blocksScanned.toLocaleString()}`);
          console.log(`   - Events found: ${result.eventsDecoded.toLocaleString()}`);
          console.log(`   - Events written: ${result.eventsWritten.toLocaleString()}`);
          console.log(`   - Duplicates skipped: ${result.duplicates.toLocaleString()}`);
          console.log(`   - Time: ${Math.round(result.elapsedMs / 1000)}s`);
          console.log('');
        }
      } else {
        console.log('🌍 Backfilling ALL events (global)');
        console.log('');

        console.log('📊 Current status:');
        console.log(`   - Last checkpoint: ${status.checkpoint?.toLocaleString() ?? 'none'}`);
        console.log(`   - Latest block: ${status.latestBlock.toLocaleString()}`);
        console.log(`   - Blocks behind: ${status.blocksBehind.toLocaleString()}`);
        console.log(`   - Events synced: ${status.eventsCount.toLocaleString()}`);
        console.log('');

        if (status.blocksBehind === 0 && startChoice.reason === 'checkpoint') {
          console.log('✅ Already up to date!');
        } else {
          console.log('🚀 Starting backfill...');
          console.log('');

          const result = await indexer.index({
            checkpointKey: 'global',
            dryRun: options.dryRun,
            fromBlock: startChoice.reason === 'checkpoint' ? undefined : startChoice.start,
          });

          console.log('');
          console.log('╔════════════════════════════════════════════════════════════════╗');
          console.log('║                    BACKFILL COMPLETE                          ║');
          console.log('╚════════════════════════════════════════════════════════════════╝');
          console.log('');
          console.log(`   📦 Blocks scanned: ${result.blocksScanned.toLocaleString()}`);
          console.log(`   📝 Logs found: ${result.logsFound.toLocaleString()}`);
          console.log(`   ✅ Events decoded: ${result.eventsDecoded.toLocaleString()}`);
          console.log(`   💾 Events written: ${result.eventsWritten.toLocaleString()}`);
          console.log(`   ⏭️  Duplicates skipped: ${result.duplicates.toLocaleString()}`);
          console.log(`   ⏱️  Time elapsed: ${Math.round(result.elapsedMs / 1000)}s`);
          console.log(
            `   ⚡ Performance: ${Math.round(
              result.blocksScanned / (result.elapsedMs / 1000)
            )} blocks/s`
          );
          console.log('');
        }
      }
    }

    if (runPools) {
      const poolResult = await indexer.indexPoolEvents({
        checkpointKey: 'all',
        fromBlock: options.fromBlock,
        dryRun: options.dryRun,
      });

      if (poolResult.eventsDecoded > 0) {
        console.log(
          `[pools] ✅ ${poolResult.eventsDecoded} events written (${poolResult.blocksScanned.toLocaleString()} pool-blocks)`
        );
      } else {
        console.log(
          `[pools] ✓ scanned ${poolResult.blocksScanned.toLocaleString()} pool-blocks (${poolResult.logsFound} logs)`
        );
      }
    }
  } catch (error) {
    console.error('');
    console.error('❌ BACKFILL FAILED:');
    console.error(error);
    console.error('');
    process.exit(1);
  } finally {
    // Log final cost summary
    try {
      const costSummary = indexer.getCostSummary();
      console.log('');
      console.log('💰 ANKR Cost Summary:');
      console.log(`   Total Credits: ${costSummary.totalCredits.toLocaleString()}`);
      console.log(`   USD Estimate: $${costSummary.usdEstimate.toFixed(4)}`);
      console.log('   By Method:');
      for (const [method, stats] of Object.entries(costSummary.byMethod)) {
        console.log(`      ${method}: ${stats.count} calls (${stats.credits} credits)`);
      }
      console.log('');
    } catch (error) {
      // Ignore if cost tracking unavailable
    }
    await indexer.close();
  }

  console.log('✨ Done!');
  console.log('');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
