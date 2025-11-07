import { decodeEventLog, type Hex } from 'viem';
import { RpcScanner } from './rpcScanner';
import {
  POOL_EVENT_TOPICS,
  POOL_EVENTS_ABI,
  POOL_SWAP_TOPIC,
  POOL_MINT_TOPIC,
  POOL_BURN_TOPIC,
  POOL_COLLECT_TOPIC,
  type PoolEventName,
} from './abis/pool';
import { type PoolEventRow } from './dbWriter';

export interface PoolScanResult {
  rows: PoolEventRow[];
  logsFound: number;
  scannedBlocks: number;
  elapsedMs: number;
}

interface ScanOptions {
  fromBlock: number;
  toBlock: number;
  pools: string[];
}

export class PoolScanner {
  private timestampCache = new Map<number, number>();

  constructor(private rpcScanner: RpcScanner) {}

  async scan(options: ScanOptions): Promise<PoolScanResult> {
    const { fromBlock, toBlock, pools } = options;
    const rows: PoolEventRow[] = [];
    let logsFound = 0;
    let scannedBlocks = 0;
    const startTime = Date.now();
    const debug = process.env.POOL_DEBUG === '1';
    let firstRow: PoolEventRow | undefined;
    let decodeFailures = 0;

    for (const pool of pools) {
      const scanResult = await this.rpcScanner.scan({
        fromBlock,
        toBlock,
        contractAddress: pool as `0x${string}`,
        topics: POOL_EVENT_TOPICS,
      });

      logsFound += scanResult.logs.length;
      scannedBlocks += scanResult.scannedBlocks;

      for (const log of scanResult.logs) {
        if (!log.transactionHash || log.logIndex === undefined) continue;

        const topic0 = log.topics?.[0]?.toLowerCase();
        const eventName = topicToEventName(topic0);
        if (!eventName) continue;

        try {
          const decoded = decodeEventLog({
            abi: POOL_EVENTS_ABI,
            topics: log.topics as Hex[],
            data: log.data,
            strict: true,
          });

          const blockNumber = Number(log.blockNumber);
          const logIndex = Number(log.logIndex);
          const txHash = log.transactionHash.toLowerCase();
          const poolAddress = pool.toLowerCase();

          let timestamp = this.timestampCache.get(blockNumber);
          if (timestamp === undefined) {
            timestamp = await this.rpcScanner.getBlockTimestamp(blockNumber);
            this.timestampCache.set(blockNumber, timestamp);
          }

          rows.push(
            mapPoolEvent({
              eventName,
              decodedArgs: decoded.args ?? {},
              blockNumber,
              logIndex,
              txHash,
              pool: poolAddress,
              timestamp,
            })
          );
          if (!firstRow) {
            firstRow = rows[rows.length - 1];
          }
        } catch (error) {
          decodeFailures += 1;
          if (debug) {
            console.warn(
              `[PoolScanner] decode failed pool=${pool} block=${log.blockNumber?.toString() ?? 'n/a'} tx=${log.transactionHash?.slice(0, 10) ?? 'n/a'} reason=${(error as Error).message}`
            );
          }
        }
      }
    }

    if (debug && firstRow) {
      console.log(
        '[PoolScanner] sample row',
        JSON.stringify(
          {
            eventName: firstRow.eventName,
            pool: firstRow.pool,
            blockNumber: firstRow.blockNumber,
            txHash: firstRow.txHash,
            logIndex: firstRow.logIndex,
          },
          null,
          0
        )
      );
    }
    if (debug && decodeFailures > 0) {
      console.warn(`[PoolScanner] decode failures=${decodeFailures}`);
    }

    return {
      rows,
      logsFound,
      scannedBlocks,
      elapsedMs: Date.now() - startTime,
    };
  }
}

interface MapArgs {
  eventName: PoolEventName;
  decodedArgs: Record<string, unknown>;
  blockNumber: number;
  logIndex: number;
  txHash: string;
  pool: string;
  timestamp: number;
}

function toStringBigInt(value: unknown): string | null {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return Math.trunc(value).toString();
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return null;
}

function mapPoolEvent(args: MapArgs): PoolEventRow {
  const base: PoolEventRow = {
    id: `${args.txHash}:${args.logIndex}`,
    pool: args.pool,
    blockNumber: args.blockNumber,
    txHash: args.txHash,
    logIndex: args.logIndex,
    timestamp: args.timestamp,
    eventName: args.eventName,
    sender: null,
    owner: null,
    recipient: null,
    tickLower: null,
    tickUpper: null,
    amount: null,
    amount0: null,
    amount1: null,
    sqrtPriceX96: null,
    liquidity: null,
    tick: null,
  };

  switch (args.eventName) {
    case 'Swap': {
      base.sender = (args.decodedArgs.sender as string | undefined)?.toLowerCase() ?? null;
      base.recipient =
        (args.decodedArgs.recipient as string | undefined)?.toLowerCase() ?? null;
      base.amount0 = toStringBigInt(args.decodedArgs.amount0);
      base.amount1 = toStringBigInt(args.decodedArgs.amount1);
      base.sqrtPriceX96 = toStringBigInt(args.decodedArgs.sqrtPriceX96);
      base.liquidity = toStringBigInt(args.decodedArgs.liquidity);
      base.tick = toNumber(args.decodedArgs.tick);
      break;
    }
    case 'Mint': {
      base.sender = (args.decodedArgs.sender as string | undefined)?.toLowerCase() ?? null;
      base.owner = (args.decodedArgs.owner as string | undefined)?.toLowerCase() ?? null;
      base.tickLower = toNumber(args.decodedArgs.tickLower);
      base.tickUpper = toNumber(args.decodedArgs.tickUpper);
      base.amount = toStringBigInt(args.decodedArgs.amount);
      base.amount0 = toStringBigInt(args.decodedArgs.amount0);
      base.amount1 = toStringBigInt(args.decodedArgs.amount1);
      break;
    }
    case 'Burn': {
      base.owner = (args.decodedArgs.owner as string | undefined)?.toLowerCase() ?? null;
      base.tickLower = toNumber(args.decodedArgs.tickLower);
      base.tickUpper = toNumber(args.decodedArgs.tickUpper);
      base.amount = toStringBigInt(args.decodedArgs.amount);
      base.amount0 = toStringBigInt(args.decodedArgs.amount0);
      base.amount1 = toStringBigInt(args.decodedArgs.amount1);
      break;
    }
    case 'Collect': {
      base.owner = (args.decodedArgs.owner as string | undefined)?.toLowerCase() ?? null;
      base.recipient =
        (args.decodedArgs.recipient as string | undefined)?.toLowerCase() ?? null;
      base.tickLower = toNumber(args.decodedArgs.tickLower);
      base.tickUpper = toNumber(args.decodedArgs.tickUpper);
      base.amount0 = toStringBigInt(args.decodedArgs.amount0);
      base.amount1 = toStringBigInt(args.decodedArgs.amount1);
      break;
    }
  }

  return base;
}

function topicToEventName(topic?: string): PoolEventName | null {
  switch (topic) {
    case POOL_SWAP_TOPIC.toLowerCase():
      return 'Swap';
    case POOL_MINT_TOPIC.toLowerCase():
      return 'Mint';
    case POOL_BURN_TOPIC.toLowerCase():
      return 'Burn';
    case POOL_COLLECT_TOPIC.toLowerCase():
      return 'Collect';
    default:
      return null;
  }
}
