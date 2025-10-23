"use strict";
/**
 * RPC Scanner with Adaptive Retry & Concurrency
 *
 * Fetches blockchain logs in chunks with exponential backoff and adaptive concurrency control.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RpcScanner = void 0;
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const p_limit_1 = __importDefault(require("p-limit"));
const indexer_config_1 = require("../../indexer.config");
const abis_1 = require("./abis");
class RpcScanner {
    constructor() {
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
        this.client = (0, viem_1.createPublicClient)({
            chain: chains_1.flare,
            transport: (0, viem_1.http)(indexer_config_1.indexerConfig.rpc.url, {
                timeout: indexer_config_1.indexerConfig.rpc.requestTimeout,
            }),
        });
        this.currentConcurrency = indexer_config_1.indexerConfig.rpc.maxConcurrency;
        this.limit = (0, p_limit_1.default)(this.currentConcurrency);
    }
    /**
     * Scan a block range and return all matching logs
     */
    async scan(options) {
        const startTime = Date.now();
        const { fromBlock, toBlock, contractAddress, tokenIds, dryRun } = options;
        if (fromBlock > toBlock) {
            throw new Error(`Invalid range: fromBlock (${fromBlock}) > toBlock (${toBlock})`);
        }
        // Calculate chunk ranges
        const ranges = this.createChunkRanges(fromBlock, toBlock, indexer_config_1.indexerConfig.rpc.batchSize);
        console.log(`[RPC] Scanning ${fromBlock}→${toBlock} (${ranges.length} chunks, concurrency=${this.currentConcurrency})`);
        // Fetch logs in parallel with concurrency limit
        const results = await Promise.all(ranges.map((range) => this.limit(() => this.fetchLogsWithRetry(range, contractAddress, tokenIds, dryRun))));
        // Merge all logs
        const allLogs = results.flatMap((r) => r.logs);
        const totalRetries = results.reduce((sum, r) => sum + r.retriesUsed, 0);
        const elapsedMs = Date.now() - startTime;
        const scannedBlocks = toBlock - fromBlock + 1;
        console.log(`[RPC] ✓ Scanned ${scannedBlocks} blocks → ${allLogs.length} logs (${Math.round(scannedBlocks / (elapsedMs / 1000))}/s, ${totalRetries} retries)`);
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
    async fetchLogsWithRetry(range, contractAddress, tokenIds, dryRun) {
        const { from, to } = range;
        let attempt = 0;
        let delay = indexer_config_1.indexerConfig.retry.initialDelayMs;
        while (attempt < indexer_config_1.indexerConfig.retry.maxAttempts) {
            try {
                // Get event topics for filtering
                const eventTopics = (0, abis_1.getEventTopics)(indexer_config_1.indexerConfig.events);
                // Fetch all logs for this contract in the block range
                // We filter by event topics client-side since viem's getLogs doesn't support OR filtering on topics[0]
                const logs = await this.client.getLogs({
                    address: contractAddress,
                    fromBlock: BigInt(from),
                    toBlock: BigInt(to),
                });
                // Filter by event topics (topics[0] contains the event signature)
                let filteredLogs = logs.filter(log => log.topics[0] && eventTopics.includes(log.topics[0]));
                // Filter by tokenId if specified (post-filter for events that index tokenId in topics[1])
                if (tokenIds && tokenIds.length > 0) {
                    filteredLogs = filteredLogs.filter((log) => {
                        // tokenId is in topics[1] for IncreaseLiquidity, DecreaseLiquidity, Collect, Transfer
                        const tokenIdHex = log.topics[1];
                        if (!tokenIdHex)
                            return false;
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
            }
            catch (error) {
                attempt++;
                this.onFailure();
                const isLastAttempt = attempt >= indexer_config_1.indexerConfig.retry.maxAttempts;
                if (isLastAttempt) {
                    console.error(`[RPC] ✗ ${from}→${to} failed after ${attempt} attempts:`, error);
                    throw error;
                }
                console.warn(`[RPC] ⚠ ${from}→${to} failed (attempt ${attempt}/${indexer_config_1.indexerConfig.retry.maxAttempts}), retrying in ${delay}ms...`);
                await this.sleep(delay);
                delay = Math.min(delay * indexer_config_1.indexerConfig.retry.backoffMultiplier, indexer_config_1.indexerConfig.retry.maxDelayMs);
            }
        }
        throw new Error(`Unreachable: max retries exceeded for ${from}→${to}`);
    }
    /**
     * Get latest block number from RPC
     */
    async getLatestBlock() {
        const blockNumber = await this.client.getBlockNumber();
        return Number(blockNumber);
    }
    /**
     * Get block timestamp
     */
    async getBlockTimestamp(blockNumber) {
        const block = await this.client.getBlock({ blockNumber: BigInt(blockNumber) });
        return Number(block.timestamp);
    }
    /**
     * Split block range into chunks
     */
    createChunkRanges(from, to, chunkSize) {
        const ranges = [];
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
    onFailure() {
        this.consecutiveFailures++;
        this.consecutiveSuccesses = 0;
        if (this.consecutiveFailures >= indexer_config_1.indexerConfig.retry.failureThreshold) {
            const newConcurrency = Math.max(this.currentConcurrency - 1, indexer_config_1.indexerConfig.rpc.minConcurrency);
            if (newConcurrency !== this.currentConcurrency) {
                console.log(`[RPC] 🔻 Reducing concurrency: ${this.currentConcurrency} → ${newConcurrency}`);
                this.currentConcurrency = newConcurrency;
                this.limit = (0, p_limit_1.default)(newConcurrency);
            }
            this.consecutiveFailures = 0;
        }
    }
    onSuccess() {
        this.consecutiveSuccesses++;
        this.consecutiveFailures = 0;
        if (this.consecutiveSuccesses >= indexer_config_1.indexerConfig.retry.successThreshold) {
            const newConcurrency = Math.min(this.currentConcurrency + 1, indexer_config_1.indexerConfig.rpc.maxConcurrency);
            if (newConcurrency !== this.currentConcurrency) {
                console.log(`[RPC] 🔺 Increasing concurrency: ${this.currentConcurrency} → ${newConcurrency}`);
                this.currentConcurrency = newConcurrency;
                this.limit = (0, p_limit_1.default)(newConcurrency);
            }
            this.consecutiveSuccesses = 0;
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.RpcScanner = RpcScanner;
