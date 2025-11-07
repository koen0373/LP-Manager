#!/usr/bin/env tsx

/**
 * Dev runner for pool-contract events indexing
 * 
 * Usage:
 *   pnpm exec tsx scripts/dev/run-pools.ts [--from=BLOCK] [--to=BLOCK] [--dry]
 */

import { IndexerCore } from '../../src/indexer/indexerCore';
import { indexerConfig } from '../../indexer.config';

interface CliOptions {
  fromBlock?: number;
  toBlock?: number;
  dryRun: boolean;
}

function parseArgs(rawArgs: string[]): CliOptions {
  let fromBlock: number | undefined;
  let toBlock: number | undefined;
  let dryRun = false;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg === '--dry' || arg === '--dry-run') {
      dryRun = true;
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

    if (arg === '--to' && i + 1 < rawArgs.length) {
      toBlock = parseInt(rawArgs[++i], 10);
      continue;
    }
    if (arg.startsWith('--to=')) {
      toBlock = parseInt(arg.split('=')[1], 10);
      continue;
    }
  }

  return { fromBlock, toBlock, dryRun };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const core = new IndexerCore();

  const fromBlock = options.fromBlock ?? 49618000;
  let toBlock = options.toBlock;

  if (!toBlock) {
    const latestBlock = await core['scanner'].getLatestBlock();
    toBlock = latestBlock - indexerConfig.follower.confirmationBlocks;
  }

  console.log(
    JSON.stringify({
      mode: 'dev-pools',
      fromBlock,
      toBlock,
      dryRun: options.dryRun,
      timestamp: new Date().toISOString(),
    })
  );

  const result = await core.indexPoolEvents({
    fromBlock,
    toBlock,
    checkpointKey: 'all',
    dryRun: options.dryRun,
  });

  console.log(
    JSON.stringify({
      mode: 'dev-pools',
      result: {
        blocksScanned: result.blocksScanned,
        logsFound: result.logsFound,
        eventsDecoded: result.eventsDecoded,
        eventsWritten: result.eventsWritten,
        duplicates: result.duplicates,
        errors: result.errors,
        elapsedMs: result.elapsedMs,
        checkpointSaved: result.checkpointSaved,
      },
    })
  );

  await core.close();
}

main().catch((error) => {
  console.error(JSON.stringify({ mode: 'dev-pools', error: error.message }));
  process.exit(1);
});
