import { promises as fs } from 'fs';
import path from 'path';
import { createPublicClient, http, type PublicClient, type Hex } from 'viem';
import { keccak256, toHex } from 'viem';
import { flare } from 'viem/chains';
import { indexerConfig } from '../../indexer.config';
import { TRANSFER_TOPIC } from '../../src/indexer/abis';

export type StartReason = 'cli' | 'tokenMint' | 'minFactory' | 'checkpoint';

export interface ChooseStartParams {
  cliFrom?: number;
  factory: 'enosys' | 'sparkdex' | 'all';
  tokenIds?: string[];
  startBlocks: Record<string, number>;
  checkpoint?: number | null;
  reset?: boolean;
  findFirstTokenMint?: (tokenId: string) => Promise<number | null>;
  fallbackStart: number;
  factoryStartOverride?: number;
}

export interface ChooseStartResult {
  start: number;
  reason: StartReason;
}

export const blockTsCache = new Map<number, number>();

const DEFAULT_START_BLOCKS_PATH = path.join(process.cwd(), 'data/config/startBlocks.json');
const ZERO_ADDRESS_TOPIC = `0x${'0'.repeat(64)}`;
const MINT_TOPIC = keccak256(
  toHex('Mint(address,address,uint256,uint128,uint256,uint256)')
);

export function createRpcClient(): PublicClient {
  return createPublicClient({
    chain: flare,
    transport: http(indexerConfig.rpc.url, {
      timeout: indexerConfig.rpc.requestTimeout,
    }),
  });
}

export async function loadStartBlocks(
  filePath = DEFAULT_START_BLOCKS_PATH
): Promise<Record<string, number>> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, number>;
    }
    return {};
  } catch (error: any) {
    if (error && error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

export function sanitizeRpcUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.username) {
      parsed.username = '***';
    }
    if (parsed.password) {
      parsed.password = '***';
    }
    for (const key of parsed.searchParams.keys()) {
      if (/key|token|secret/i.test(key)) {
        parsed.searchParams.set(key, '***');
      }
    }
    return parsed.toString();
  } catch {
    return url.replace(/([A-Za-z0-9]{8,})/g, '***');
  }
}

export async function getBlockTimestamp(
  client: PublicClient,
  blockNumber: number
): Promise<number> {
  if (blockTsCache.has(blockNumber)) {
    return blockTsCache.get(blockNumber)!;
  }
  const block = await client.getBlock({ blockNumber: BigInt(blockNumber) });
  const ts = Number(block.timestamp);
  blockTsCache.set(blockNumber, ts);
  return ts;
}

export function isoFromUnix(sec: number): string {
  return new Date(sec * 1000).toISOString();
}

export async function chooseStart({
  cliFrom,
  factory,
  tokenIds = [],
  startBlocks,
  checkpoint,
  reset,
  findFirstTokenMint,
  fallbackStart,
  factoryStartOverride,
}: ChooseStartParams): Promise<ChooseStartResult> {
  if (typeof cliFrom === 'number' && !Number.isNaN(cliFrom)) {
    return { start: cliFrom, reason: 'cli' };
  }

  const factories =
    factory === 'all'
      ? Object.keys(startBlocks).length > 0
        ? Object.keys(startBlocks)
        : ['enosys', 'sparkdex']
      : [factory];

  const factoryStarts =
    typeof factoryStartOverride === 'number' && Number.isFinite(factoryStartOverride)
      ? [factoryStartOverride]
      : factories
          .map((id) => startBlocks[id])
          .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const fallback = Number.isFinite(fallbackStart) ? fallbackStart : 0;
  const factoryStart = factoryStarts.length > 0 ? Math.min(...factoryStarts) : fallback;

  let start = factoryStart;
  let reason: StartReason = 'minFactory';

  if (tokenIds.length > 0 && findFirstTokenMint) {
    let minMint = Infinity;
    for (const tokenId of tokenIds) {
      try {
        const mintBlock = await findFirstTokenMint(tokenId);
        if (mintBlock !== null && mintBlock < minMint) {
          minMint = mintBlock;
        }
      } catch {
        // ignore individual token failures
      }
    }
    if (Number.isFinite(minMint)) {
      start = Math.min(start, minMint);
      if (minMint < factoryStart) {
        reason = 'tokenMint';
      }
    }
  }

  if (checkpoint != null && !reset) {
    return { start: checkpoint + 1, reason: 'checkpoint' };
  }

  return { start, reason };
}

export interface FindFirstTokenMintParams {
  client: PublicClient;
  nfpmAddress: string;
  tokenId: string;
  startBlock: number;
  endBlock?: number;
  chunk?: number;
  rps?: number;
}

export async function findFirstTokenMint({
  client,
  nfpmAddress,
  tokenId,
  startBlock,
  endBlock,
  chunk = 1000,
  rps = 5,
}: FindFirstTokenMintParams): Promise<number | null> {
  const tokenTopic = `0x${BigInt(tokenId).toString(16).padStart(64, '0')}` as Hex;
  const latestBlock = endBlock ?? Number(await client.getBlockNumber());
  let current = startBlock;
  const delayMs = rps > 0 ? Math.ceil(1000 / rps) : 0;

  while (current <= latestBlock) {
    const rangeEnd = Math.min(current + chunk - 1, latestBlock);
    try {
      const logs = await client.getLogs({
        address: nfpmAddress as `0x${string}`,
        fromBlock: BigInt(current),
        toBlock: BigInt(rangeEnd),
      });

      let earliest: number | null = null;

      for (const log of logs) {
        if (!log.topics || log.topics.length === 0) continue;
        if (!log.topics.includes(tokenTopic)) continue;

        const topic0 = log.topics[0];
        if (topic0 === MINT_TOPIC || (topic0 === TRANSFER_TOPIC && log.topics[1] === ZERO_ADDRESS_TOPIC)) {
          const block = Number(log.blockNumber);
          if (!earliest || block < earliest) {
            earliest = block;
          }
        }
      }

      if (earliest != null) {
        return earliest;
      }
    } catch (error: any) {
      const message = error?.message ?? '';
      if (typeof message === 'string' && message.includes('429')) {
        const backoff = Math.min(delayMs * 2, 15000);
        await sleep(backoff);
        continue;
      }
      throw error;
    }

    current = rangeEnd + 1;
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
