import { type Address, getAddress, parseAbiItem } from 'viem';

import { publicClient } from '@/lib/viemClient';
import { prisma } from '@/server/db';

type SourceKey = 'enosys' | 'sparkdex';

type SourceConfig = {
  key: SourceKey;
  address: Address;
  startBlock: bigint;
  normalized: string;
};

type PositionCountRow = {
  nfpm: string;
  total: bigint | number;
  last_block: bigint | number | null;
  updated_at: Date;
};

type AggregateSummary = {
  enosys: number;
  sparkdex: number;
  total: number;
  lastBlock: number;
};

type CachedSummary = {
  enosys: number;
  sparkdex: number;
  total: number;
  updatedAt: string | null;
};

const ZERO_ADDRESS = getAddress('0x0000000000000000000000000000000000000000');
const LOG_CHUNK = 10_000n;
const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)');

const SOURCE_SPECS = [
  { key: 'enosys' as const, env: 'ENOSYS_NFPM', startEnv: 'ENOSYS_NFPM_START_BLOCK' },
  { key: 'sparkdex' as const, env: 'SPARKDEX_NFPM', startEnv: 'SPARKDEX_NFPM_START_BLOCK' },
] as const;

let tableReady = false;

export async function aggregatePositionCountsViaRpc(): Promise<AggregateSummary> {
  await ensurePositionCountsTable();

  const configs = loadSourceConfigs();
  if (!configs.length) {
    return { enosys: 0, sparkdex: 0, total: 0, lastBlock: 0 };
  }

  const latestBlock = await publicClient.getBlockNumber();
  const perSource: Record<SourceKey, { total: number; lastBlock: number }> = {
    enosys: { total: 0, lastBlock: 0 },
    sparkdex: { total: 0, lastBlock: 0 },
  };

  for (const config of configs) {
    try {
      const existing = await readExistingRow(config.normalized);
      const previousTotal = existing ? toBigInt(existing.total) : 0n;
      const previousLastBlock = existing ? toBigInt(existing.last_block ?? 0) : (config.startBlock > 0n ? config.startBlock - 1n : 0n);
      const effectiveFrom = determineFromBlock(previousLastBlock + 1n, config.startBlock);

      let mintedDelta = 0n;
      let processedBlock = previousLastBlock;

      if (effectiveFrom <= latestBlock) {
        const scanResult = await countMintLogs(config.address, effectiveFrom, latestBlock);
        mintedDelta = scanResult.mintedDelta;
        processedBlock = scanResult.processedBlock > processedBlock ? scanResult.processedBlock : processedBlock;
      }

      const updatedTotal = previousTotal + mintedDelta;
      const finalLastBlock = processedBlock > previousLastBlock ? processedBlock : previousLastBlock;

      await upsertPositionCount(config.normalized, updatedTotal, finalLastBlock);

      perSource[config.key] = {
        total: Number(updatedTotal),
        lastBlock: Number(finalLastBlock),
      };
    } catch (error) {
      console.warn('[positionCountService] failed to aggregate counts', {
        nfpm: config.address,
        error,
      });
    }
  }

  return {
    enosys: perSource.enosys.total,
    sparkdex: perSource.sparkdex.total,
    total: perSource.enosys.total + perSource.sparkdex.total,
    lastBlock: Math.max(perSource.enosys.lastBlock, perSource.sparkdex.lastBlock),
  };
}

export async function getCachedPositionCounts(): Promise<CachedSummary> {
  await ensurePositionCountsTable();

  const configs = loadSourceConfigs();
  const addressMap = new Map<string, SourceKey>();
  configs.forEach((config) => addressMap.set(config.normalized, config.key));

  const rows = await prisma.$queryRaw<PositionCountRow[]>`
    SELECT nfpm, total, last_block, updated_at
    FROM position_counts
  `;

  const summary: CachedSummary = {
    enosys: 0,
    sparkdex: 0,
    total: 0,
    updatedAt: null,
  };

  for (const row of rows) {
    const key = addressMap.get(row.nfpm.toLowerCase());
    if (!key) continue;

    const total = Number(toBigInt(row.total));
    summary[key] = total;
    summary.total = summary.enosys + summary.sparkdex;

    if (!summary.updatedAt || new Date(row.updated_at).getTime() > new Date(summary.updatedAt).getTime()) {
      summary.updatedAt = row.updated_at.toISOString();
    }
  }

  return summary;
}

async function countMintLogs(address: Address, fromBlock: bigint, latest: bigint) {
  let mintedDelta = 0n;
  let processedBlock = fromBlock > 0n ? fromBlock - 1n : 0n;

  let cursor = fromBlock;
  while (cursor <= latest) {
    const chunkEnd = cursor + LOG_CHUNK - 1n;
    const toBlock = chunkEnd > latest ? latest : chunkEnd;

    try {
      const logs = await publicClient.getLogs({
        address,
        event: TRANSFER_EVENT,
        args: { from: ZERO_ADDRESS },
        fromBlock: cursor,
        toBlock,
      });

      mintedDelta += BigInt(logs.length);
      processedBlock = toBlock;
    } catch (error) {
      console.warn('[positionCountService] log scan error', {
        address,
        fromBlock: cursor,
        toBlock,
        error,
      });
      break;
    }

    if (toBlock === latest) break;
    cursor = toBlock + 1n;
  }

  return { mintedDelta, processedBlock };
}

async function readExistingRow(nfpm: string) {
  const rows = await prisma.$queryRaw<PositionCountRow[]>`
    SELECT nfpm, total, last_block, updated_at
    FROM position_counts
    WHERE nfpm = ${nfpm}
    LIMIT 1
  `;
  return rows[0];
}

async function upsertPositionCount(nfpm: string, total: bigint, lastBlock: bigint) {
  await prisma.$executeRaw`
    INSERT INTO position_counts (nfpm, total, last_block, updated_at)
    VALUES (${nfpm}, ${total}, ${lastBlock}, NOW())
    ON CONFLICT (nfpm)
    DO UPDATE
    SET total = EXCLUDED.total,
        last_block = EXCLUDED.last_block,
        updated_at = NOW()
  `;
}

function loadSourceConfigs(): SourceConfig[] {
  return SOURCE_SPECS.map((spec) => {
    const addressValue = process.env[spec.env];
    if (!addressValue) return null;

    try {
      const address = getAddress(addressValue as `0x${string}`);
      const startBlock = parseEnvBigInt(process.env[spec.startEnv]) ?? 0n;
      return {
        key: spec.key,
        address,
        startBlock,
        normalized: address.toLowerCase(),
      };
    } catch {
      return null;
    }
  }).filter((entry): entry is SourceConfig => Boolean(entry));
}

function parseEnvBigInt(value?: string): bigint {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function determineFromBlock(candidate: bigint, minimum: bigint) {
  return candidate < minimum ? minimum : candidate;
}

function toBigInt(value: bigint | number | null | undefined): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

async function ensurePositionCountsTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS position_counts (
      nfpm TEXT PRIMARY KEY,
      total BIGINT NOT NULL DEFAULT 0,
      last_block BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  tableReady = true;
}
