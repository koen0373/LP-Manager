/**
 * RPC Scanner with Adaptive Retry & Concurrency
 * 
 * Fetches blockchain logs in chunks with exponential backoff and adaptive concurrency control.
 */

import { createPublicClient, http, Log, type PublicClient } from 'viem';
import { flare } from 'viem/chains';
import pLimit from 'p-limit';
import { indexerConfig } from '../../indexer.config';
import { getEventTopics } from './abis';

export interface ScanOptions {
  fromBlock: number;
  toBlock: number;
  contractAddress: string;
  tokenIds?: string[]; // Optional: filter by specific tokenIds
  dryRun?: boolean;
}

export interface ScanResult {
  logs: Log[];
  scannedBlocks: number;
  elapsedMs: number;
  retriesUsed: number;
}

export class RpcScanner {
  private client: PublicClient;
  private limit: ReturnType<typeof pLimit>;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private currentConcurrency: number;

  constructor() {
    this.client = createPublicClient({
      chain: flare,
      transport: http(indexerConfig.rpc.url, {
        timeout: indexerConfig.rpc.requestTimeout,
      }),
    });

    this.currentConcurrency = indexerConfig.rpc.maxConcurrency;
    this.limit = pLimit(this.currentConcurrency);
  }

  /**
   * Scan a block range and return all matching logs
   */
  async scan(options: ScanOptions): Promise<ScanResult> {
    const startTime = Date.now();
    const { fromBlock, toBlock, contractAddress, tokenIds, dryRun } = options;

    if (fromBlock > toBlock) {
      throw new Error(`Invalid range: fromBlock (${fromBlock}) > toBlock (${toBlock})`);
    }

    // Calculate chunk ranges
    const ranges = this.createChunkRanges(fromBlock, toBlock, indexerConfig.rpc.batchSize);
    console.log(`[RPC] Scanning ${fromBlock}→${toBlock} (${ranges.length} chunks, concurrency=${this.currentConcurrency})`);

    // Fetch logs in parallel with concurrency limit
    const results = await Promise.all(
      ranges.map((range) =>
        this.limit(() => this.fetchLogsWithRetry(range, contractAddress, tokenIds, dryRun))
      )
    );

    // Merge all logs
    const allLogs = results.flatMap((r) => r.logs);
    const totalRetries = results.reduce((sum, r) => sum + r.retriesUsed, 0);

    const elapsedMs = Date.now() - startTime;
    const scannedBlocks = toBlock - fromBlock + 1;

    console.log(
      `[RPC] ✓ Scanned ${scannedBlocks} blocks → ${allLogs.length} logs (${Math.round(scannedBlocks / (elapsedMs / 1000))}/s, ${totalRetries} retries)`
    );

    return {
      logs: allLogs,
      scannedBlocks,
      elapsedMs,
      retriesUsed: totalRetries,
    };
  }

  /**
   * Fetch logs for a single chunk with exponential backoff retry
   */
  private async fetchLogsWithRetry(
    range: { from: number; to: number },
    contractAddress: string,
    tokenIds?: string[],
    dryRun?: boolean
  ): Promise<{ logs: Log[]; retriesUsed: number }> {
    const { from, to } = range;
    let attempt = 0;
    let delay = indexerConfig.retry.initialDelayMs;

    while (attempt < indexerConfig.retry.maxAttempts) {
      try {
        // Get event topics - viem requires topics[0] to be an array for OR filtering
        const eventTopics = getEventTopics(indexerConfig.events);

        // Fetch logs - topics[0] as array means "match any of these event signatures"
        const logs = await this.client.getLogs({
          address: contractAddress as `0x${string}`,
          fromBlock: BigInt(from),
          toBlock: BigInt(to),
        } as any); // Type assertion needed as viem's types don't expose raw topics filtering correctly
        
        // Manual filter by event topics (since we can't pass topics directly)
        let filteredLogs = logs.filter(log => 
          log.topics[0] && eventTopics.includes(log.topics[0] as string)
        );

        // Filter by tokenId if specified (post-filter for events that index tokenId in topics[1])
        if (tokenIds && tokenIds.length > 0) {
          filteredLogs = filteredLogs.filter((log) => {
            // tokenId is in topics[1] for IncreaseLiquidity, DecreaseLiquidity, Collect, Transfer
            const tokenIdHex = log.topics[1];
            if (!tokenIdHex) return false;
            const tokenId = BigInt(tokenIdHex).toString();
            return tokenIds.includes(tokenId);
          });
        }

        if (!dryRun && filteredLogs.length > 0) {
          console.log(`[RPC] ✓ ${from}→${to} (${filteredLogs.length} logs)`);
        }

        // Track success
        this.onSuccess();

        return { logs: filteredLogs, retriesUsed: attempt };
      } catch (error) {
        attempt++;
        this.onFailure();

        const isLastAttempt = attempt >= indexerConfig.retry.maxAttempts;

        if (isLastAttempt) {
          console.error(`[RPC] ✗ ${from}→${to} failed after ${attempt} attempts:`, error);
          throw error;
        }

        console.warn(
          `[RPC] ⚠ ${from}→${to} failed (attempt ${attempt}/${indexerConfig.retry.maxAttempts}), retrying in ${delay}ms...`
        );

        await this.sleep(delay);
        delay = Math.min(delay * indexerConfig.retry.backoffMultiplier, indexerConfig.retry.maxDelayMs);
      }
    }

    throw new Error(`Unreachable: max retries exceeded for ${from}→${to}`);
  }

  /**
   * Get latest block number from RPC
   */
  async getLatestBlock(): Promise<number> {
    const blockNumber = await this.client.getBlockNumber();
    return Number(blockNumber);
  }

  /**
   * Get block timestamp
   */
  async getBlockTimestamp(blockNumber: number): Promise<number> {
    const block = await this.client.getBlock({ blockNumber: BigInt(blockNumber) });
    return Number(block.timestamp);
  }

  /**
   * Split block range into chunks
   */
  private createChunkRanges(from: number, to: number, chunkSize: number): Array<{ from: number; to: number }> {
    const ranges: Array<{ from: number; to: number }> = [];
    let current = from;

    while (current <= to) {
      const end = Math.min(current + chunkSize - 1, to);
      ranges.push({ from: current, to: end });
      current = end + 1;
    }

    return ranges;
  }

  /**
   * Adaptive concurrency: reduce on failures, increase on successes
   */
  private onFailure() {
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;

    if (this.consecutiveFailures >= indexerConfig.retry.failureThreshold) {
      const newConcurrency = Math.max(this.currentConcurrency - 1, indexerConfig.rpc.minConcurrency);
      if (newConcurrency !== this.currentConcurrency) {
        console.log(`[RPC] 🔻 Reducing concurrency: ${this.currentConcurrency} → ${newConcurrency}`);
        this.currentConcurrency = newConcurrency;
        this.limit = pLimit(newConcurrency);
      }
      this.consecutiveFailures = 0;
    }
  }

  private onSuccess() {
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;

    if (this.consecutiveSuccesses >= indexerConfig.retry.successThreshold) {
      const newConcurrency = Math.min(this.currentConcurrency + 1, indexerConfig.rpc.maxConcurrency);
      if (newConcurrency !== this.currentConcurrency) {
        console.log(`[RPC] 🔺 Increasing concurrency: ${this.currentConcurrency} → ${newConcurrency}`);
        this.currentConcurrency = newConcurrency;
        this.limit = pLimit(newConcurrency);
      }
      this.consecutiveSuccesses = 0;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

