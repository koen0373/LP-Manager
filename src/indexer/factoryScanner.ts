import { decodeEventLog, type Hex } from 'viem';
import { FACTORY_EVENT_TOPICS, FACTORY_EVENTS_ABI, type FactoryEventName } from './abis/factory';
import { RpcScanner } from './rpcScanner';

export interface FactoryScanResult {
  events: FactoryEvent[];
  logsFound: number;
  scannedBlocks: number;
  elapsedMs: number;
}

export interface FactoryEvent {
  pool: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  timestamp: number;
  eventName: FactoryEventName;
}

export class FactoryScanner {
  private rpcScanner: RpcScanner;
  private timestampCache = new Map<number, number>();

  constructor(rpcScanner?: RpcScanner) {
    this.rpcScanner = rpcScanner ?? new RpcScanner();
  }

  async scan(options: {
    fromBlock: number;
    toBlock: number;
    factoryAddress: string;
  }): Promise<FactoryScanResult> {
    const { fromBlock, toBlock, factoryAddress } = options;

    const scanResult = await this.rpcScanner.scan({
      fromBlock,
      toBlock,
      contractAddress: factoryAddress,
      topics: FACTORY_EVENT_TOPICS,
    });

    const events: FactoryEvent[] = [];

    for (const log of scanResult.logs) {
      if (!log.transactionHash || log.logIndex === undefined) {
        continue;
      }

      try {
        const decoded = decodeEventLog({
          abi: FACTORY_EVENTS_ABI,
          data: log.data,
          topics: log.topics as Hex[],
          strict: false,
        });

        const eventName = decoded.eventName as FactoryEventName;
        const poolAddress = (decoded.args?.pool as `0x${string}` | undefined)?.toLowerCase();
        if (!poolAddress) continue;

        const blockNumber = Number(log.blockNumber);
        const logIndex = Number(log.logIndex);
        const txHash = log.transactionHash.toLowerCase();

        let timestamp = this.timestampCache.get(blockNumber);
        if (timestamp === undefined) {
          timestamp = await this.rpcScanner.getBlockTimestamp(blockNumber);
          this.timestampCache.set(blockNumber, timestamp);
        }

        events.push({
          pool: poolAddress,
          blockNumber,
          txHash,
          logIndex,
          timestamp,
          eventName,
        });
      } catch (error) {
        console.warn('[FactoryScanner] Failed to decode factory log', error);
      }
    }

    return {
      events,
      logsFound: scanResult.logs.length,
      scannedBlocks: scanResult.scannedBlocks,
      elapsedMs: scanResult.elapsedMs,
    };
  }
}
