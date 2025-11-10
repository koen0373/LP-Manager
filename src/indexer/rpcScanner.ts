/**
 * RPC Scanner with Adaptive Retry, Concurrency & Cost Tracking
 * 
 * Fetches blockchain logs with rate limiting, adaptive window sizing, and ANKR credit tracking.
 */

import { createPublicClient, http, Log, type PublicClient } from 'viem';
import { flare } from 'viem/chains';
import pLimit from 'p-limit';
import { loadIndexerConfigFromEnv } from '../../indexer.config';
import { getEventTopics } from './abis';
import { RateLimiter } from './lib/rateLimiter';
import { CostMeter, type CostSummary } from './metrics/costMeter';

export interface ScanOptions {
  fromBlock: number;
  toBlock: number;
  contractAddress: string | string[];
  tokenIds?: string[];
  dryRun?: boolean;
  topics?: string[];
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
  private currentBlockWindow: number;
  private rateLimiter: RateLimiter;
  private costMeter: CostMeter;
  private config: ReturnType<typeof loadIndexerConfigFromEnv>;
  
  // Flare RPC hard limit: 30 blocks max per eth_getLogs call
  private static readonly FLARE_MAX_BLOCKS = 30;
  private static readonly FLARE_SAFE_WINDOW = 25; // Use 25 to stay safely under limit

  constructor() {
    this.config = loadIndexerConfigFromEnv();
    
    this.client = createPublicClient({
      chain: flare,
      transport: http(this.config.rpc.url, {
        timeout: this.config.rpc.requestTimeout,
      }),
    });

    this.currentConcurrency = this.config.rpc.concurrency;
    // HARDEN: Clamp block window to Flare's 30-block limit (use 25 for safety)
    this.currentBlockWindow = Math.min(
      this.config.rpc.blockWindow,
      RpcScanner.FLARE_SAFE_WINDOW
    );
    
    if (this.config.rpc.blockWindow > RpcScanner.FLARE_SAFE_WINDOW) {
      console.warn(
        `[RPC] ⚠ Block window ${this.config.rpc.blockWindow} exceeds Flare limit (30). Clamped to ${RpcScanner.FLARE_SAFE_WINDOW}`
      );
    }
    
    this.limit = pLimit(this.currentConcurrency);
    
    this.rateLimiter = new RateLimiter({
      rps: this.config.rpc.rps,
      burst: this.config.rpc.rps * 2,
    });
    
    this.costMeter = new CostMeter(this.config.cost);
  }

  async scan(options: ScanOptions): Promise<ScanResult> {
    const startTime = Date.now();
    const { fromBlock, toBlock, contractAddress, tokenIds, dryRun, topics } = options;

    if (fromBlock > toBlock) {
      throw new Error(`Invalid range: fromBlock (${fromBlock}) > toBlock (${toBlock})`);
    }

    const addresses = Array.isArray(contractAddress) ? contractAddress : [contractAddress];
    const ranges = this.createChunkRanges(fromBlock, toBlock, this.currentBlockWindow);
    
    // Verify ranges don't exceed Flare limit
    const maxRangeSize = Math.max(...ranges.map(r => r.to - r.from + 1));
    if (maxRangeSize > RpcScanner.FLARE_MAX_BLOCKS) {
      console.error(
        `[RPC] 🚨 CRITICAL: Some ranges exceed Flare limit! Max range size: ${maxRangeSize} blocks`
      );
    }
    
    console.log(
      `[RPC] Scanning ${fromBlock}→${toBlock} (${ranges.length} chunks, window=${this.currentBlockWindow}, max_range=${maxRangeSize}, concurrency=${this.currentConcurrency}, rps=${this.config.rpc.rps})`
    );

    const results = await Promise.all(
      ranges.map((range) =>
        this.limit(() =>
          this.rateLimiter.schedule(() =>
            this.fetchLogsWithRetry(range, addresses, tokenIds, dryRun, topics)
          )
        )
      )
    );

    const allLogs = results.flatMap((r) => r.logs);
    const totalRetries = results.reduce((sum, r) => sum + r.retriesUsed, 0);
    const elapsedMs = Date.now() - startTime;
    const scannedBlocks = toBlock - fromBlock + 1;

    console.log(
      `[RPC] ✓ Scanned ${scannedBlocks} blocks → ${allLogs.length} logs (${Math.round(
        scannedBlocks / (elapsedMs / 1000)
      )}/s, ${totalRetries} retries)`
    );

    this.logCostSummary();

    return {
      logs: allLogs,
      scannedBlocks,
      elapsedMs,
      retriesUsed: totalRetries,
    };
  }

  private async fetchLogsWithRetry(
    range: { from: number; to: number },
    addresses: string[],
    tokenIds?: string[],
    dryRun?: boolean,
    topics?: string[]
  ): Promise<{ logs: Log[]; retriesUsed: number }> {
    const { from, to } = range;
    let attempt = 0;
    let delay = this.config.retry.initialDelayMs;
    let currentWindow = this.currentBlockWindow;

    while (attempt < this.config.retry.maxAttempts) {
      try {
        this.costMeter.track('eth_getLogs');
        
        const eventTopics = topics ?? getEventTopics(this.config.events);
        const addressChunks = this.chunkAddresses(addresses, 20);
        
        let allLogs: Log[] = [];
        
        for (const addressChunk of addressChunks) {
          const logs = await this.client.getLogs({
            address: addressChunk.map((addr) => addr as `0x${string}`),
            fromBlock: BigInt(from),
            toBlock: BigInt(to),
            topics: eventTopics.length > 0 ? [eventTopics.map((t) => t as `0x${string}`)] : undefined,
          });
          allLogs.push(...logs);
        }

        let filteredLogs = allLogs;
        if (eventTopics.length > 0) {
          const topicSet = new Set(eventTopics.map((t) => t.toLowerCase()));
          filteredLogs = filteredLogs.filter(
            (log) => log.topics[0] && topicSet.has((log.topics[0] as string).toLowerCase())
          );
        }

        if (tokenIds && tokenIds.length > 0) {
          filteredLogs = filteredLogs.filter((log) => {
            const tokenIdHex = log.topics[1];
            if (!tokenIdHex) return false;
            const tokenId = BigInt(tokenIdHex).toString();
            return tokenIds.includes(tokenId);
          });
        }

        if (!dryRun && filteredLogs.length > 0) {
          console.log(`[RPC] ✓ ${from}→${to} (${filteredLogs.length} logs)`);
        }

        // Adaptive window: slowly increase on success (but never exceed Flare limit)
        if (currentWindow < this.config.rpc.blockWindow) {
          const newWindow = Math.min(
            currentWindow + 100,
            this.config.rpc.blockWindow,
            RpcScanner.FLARE_SAFE_WINDOW // Never exceed Flare limit
          );
          this.currentBlockWindow = newWindow;
        }

        this.onSuccess();
        return { logs: filteredLogs, retriesUsed: attempt };
      } catch (error: any) {
        attempt++;
        this.onFailure();

        const errorMsg = error?.message || String(error);
        const errorDetails = error?.cause?.message || error?.details || '';
        const fullError = `${errorMsg} ${errorDetails}`.toLowerCase();
        
        // Detect Flare RPC 30-block limit error
        const isFlareLimit = 
          fullError.includes('maximum is set to 30') ||
          fullError.includes('requested too many blocks') ||
          (error?.code === -32000 && fullError.includes('30'));
        
        const isTooLarge = errorMsg.includes('response too large') || errorMsg.includes('exceeds');
        const isRateLimit = errorMsg.includes('429') || errorMsg.includes('rate limit');

        // CRITICAL: If Flare limit error, aggressively reduce window to 25 or less
        if (isFlareLimit) {
          currentWindow = Math.min(currentWindow, RpcScanner.FLARE_SAFE_WINDOW);
          this.currentBlockWindow = currentWindow;
          console.error(
            `[RPC] 🚨 Flare RPC 30-block limit hit! Reducing window to ${currentWindow} (${from}→${to}, ${to - from + 1} blocks)`
          );
        } else if (isTooLarge || isRateLimit) {
          currentWindow = Math.max(Math.floor(currentWindow / 2), 10);
          // Ensure we never exceed Flare limit even after reduction
          currentWindow = Math.min(currentWindow, RpcScanner.FLARE_SAFE_WINDOW);
          this.currentBlockWindow = currentWindow;
          console.warn(`[RPC] ⚠ Reducing block window to ${currentWindow} (${from}→${to})`);
        }

        const isLastAttempt = attempt >= this.config.retry.maxAttempts;
        if (isLastAttempt) {
          console.error(`[RPC] ✗ ${from}→${to} failed after ${attempt} attempts:`, error);
          throw error;
        }

        console.warn(
          `[RPC] ⚠ ${from}→${to} failed (attempt ${attempt}/${this.config.retry.maxAttempts}), retrying in ${delay}ms...`
        );

        await this.sleep(delay);
        delay = Math.min(delay * this.config.retry.backoffMultiplier, this.config.retry.maxDelayMs);
      }
    }

    throw new Error(`Unreachable: max retries exceeded for ${from}→${to}`);
  }

  async getLatestBlock(): Promise<number> {
    this.costMeter.track('eth_blockNumber');
    const blockNumber = await this.rateLimiter.schedule(() => this.client.getBlockNumber());
    return Number(blockNumber);
  }

  async getBlockTimestamp(blockNumber: number): Promise<number> {
    this.costMeter.track('eth_getBlockByNumber');
    const block = await this.rateLimiter.schedule(() =>
      this.client.getBlock({ blockNumber: BigInt(blockNumber) })
    );
    return Number(block.timestamp);
  }

  getCostSummary(): CostSummary {
    return this.costMeter.summary();
  }

  private logCostSummary(): void {
    const summary = this.costMeter.summary();
    console.log(
      JSON.stringify({
        scope: 'cost',
        totalCredits: summary.totalCredits,
        usdEstimate: parseFloat(summary.usdEstimate.toFixed(4)),
        byMethod: summary.byMethod,
      })
    );
  }

  private chunkAddresses(addresses: string[], size: number): string[][] {
    const chunks: string[][] = [];
    for (let i = 0; i < addresses.length; i += size) {
      chunks.push(addresses.slice(i, i + size));
    }
    return chunks;
  }

  private createChunkRanges(from: number, to: number, chunkSize: number): Array<{ from: number; to: number }> {
    // HARDEN: Never exceed Flare's 30-block limit
    const safeChunkSize = Math.min(chunkSize, RpcScanner.FLARE_SAFE_WINDOW);
    
    const ranges: Array<{ from: number; to: number }> = [];
    let current = from;

    while (current <= to) {
      const end = Math.min(current + safeChunkSize - 1, to);
      const actualSize = end - current + 1;
      
      // Double-check: ensure range never exceeds Flare limit
      if (actualSize > RpcScanner.FLARE_MAX_BLOCKS) {
        console.error(
          `[RPC] 🚨 CRITICAL: Range ${current}→${end} (${actualSize} blocks) exceeds Flare limit! Splitting...`
        );
        // Force split at Flare limit
        const safeEnd = current + RpcScanner.FLARE_SAFE_WINDOW - 1;
        ranges.push({ from: current, to: Math.min(safeEnd, to) });
        current = Math.min(safeEnd, to) + 1;
      } else {
        ranges.push({ from: current, to: end });
        current = end + 1;
      }
    }

    return ranges;
  }

  private onFailure() {
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;

    if (this.consecutiveFailures >= this.config.retry.failureThreshold) {
      const newConcurrency = Math.max(
        this.currentConcurrency - 1,
        this.config.rpc.minConcurrency
      );
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

    if (this.consecutiveSuccesses >= this.config.retry.successThreshold) {
      const newConcurrency = Math.min(
        this.currentConcurrency + 1,
        this.config.rpc.concurrency
      );
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
