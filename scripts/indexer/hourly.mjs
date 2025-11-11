#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs/promises';
import process from 'node:process';

import { fetchLogsPaginated, getLatestBlock } from '@lib/ankr';
import { writePositionEvents } from '@lib/writers/positionEvents';
import { writePoolEvents } from '@lib/writers/poolEvents';
import { getCheckpoint, setCheckpoint } from '@lib/indexer/checkpoint';

const CONFIG_PATH = path.join(process.cwd(), 'config', 'indexer.json');

async function readConfig() {
  const raw = await fs.readFile(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

function parseList(source = '') {
  return source
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toRecords(logs) {
  return logs.map((log) => {
    const blockHex = typeof log.blockNumber === 'string' ? log.blockNumber : '0x0';
    const logIndexHex = typeof log.logIndex === 'string' ? log.logIndex : '0x0';
    return {
      txHash: log.transactionHash ?? '0x0',
      logIndex: Number.parseInt(logIndexHex, 16),
      blockNumber: Number.parseInt(blockHex, 16),
      payload: log,
    };
  });
}

async function processSource({ label, addresses, topics, writer, checkpointKey, step, rps, latest }) {
  if (!addresses.length) {
    console.warn(`[hourly:${label}] no addresses configured`);
    return;
  }

  const lookback = Number(process.env.INDEXER_LOOKBACK_BLOCKS ?? 7_200);
  const from = (await getCheckpoint(checkpointKey)) ?? Math.max(latest - lookback, 0);
  const to = latest;

  let checkpointTarget = to;
  /** @type {any} */
  let scanResult;

  for (const address of addresses) {
    console.log(`[hourly:${label}] ${address} from ${from} to ${to}`);
    const result = await fetchLogsPaginated({
      address,
      topics,
      fromBlock: from,
      toBlock: to,
      step,
      rps,
    });
    scanResult = result ?? scanResult ?? null;
    const events = Array.isArray(scanResult?.events)
      ? scanResult.events
      : Array.isArray(scanResult)
        ? scanResult
        : [];
    const nextFrom = Number.isFinite(scanResult?.nextFrom) ? scanResult.nextFrom : undefined;
    if (nextFrom !== undefined && nextFrom > checkpointTarget) {
      checkpointTarget = nextFrom;
    }
    if (!events.length) {
      continue;
    }
    const stats = await writer(toRecords(events));
    console.log(
      `[hourly:${label}] wrote ${stats.inserted} rows (skipped ${stats.skipped}, errors ${stats.errors}) for ${address}`
    );
  }

  await setCheckpoint(checkpointKey, checkpointTarget);
}

async function main() {
  const config = await readConfig();
  const contracts = config.contracts ?? {};
  const blocksCfg = config.blocks ?? {};
  const nfpm = contracts.NFPM?.length ? contracts.NFPM : parseList(process.env.NFPM_CONTRACTS);
  const factories = contracts.V3_FACTORIES?.length
    ? contracts.V3_FACTORIES
    : parseList(process.env.V3_FACTORY_CONTRACTS);
  const rps = config.qps ?? 2;
  const step = blocksCfg.minWindow ?? 1000;
  const nfpmTopics = parseList(process.env.NFPM_TOPICS);
  const poolTopics = parseList(process.env.POOL_TOPICS);
  const latest = await getLatestBlock();

  await processSource({
    label: 'NFPM',
    addresses: nfpm,
    topics: nfpmTopics.length ? nfpmTopics : undefined,
    writer: writePositionEvents,
    checkpointKey: 'hourly:NFPM',
    step,
    rps,
    latest,
  });

  await processSource({
    label: 'POOLS',
    addresses: factories,
    topics: poolTopics.length ? poolTopics : undefined,
    writer: writePoolEvents,
    checkpointKey: 'hourly:POOLS',
    step,
    rps,
    latest,
  });

  console.log('[indexer/hourly] completed');
}

main().catch((error) => {
  console.error('[indexer/hourly] failed', error);
  process.exitCode = 1;
});
