/**
 * Indexer Configuration
 * 
 * Production-grade settings for the Liqui blockchain indexer.
 * Tunes RPC concurrency, block ranges, retry behavior, and event types.
 */

export const indexerConfig = {
  // RPC Settings
  rpc: {
    url: process.env.FLARE_RPC_URL || 'https://flare-api.flare.network/ext/bc/C/rpc',
    batchSize: 25, // Blocks per getLogs call (Flare RPC limit is 30)
    maxConcurrency: 4, // Parallel RPC requests
    minConcurrency: 1, // Minimum when throttled
    requestTimeout: 30000, // 30s timeout per RPC call
  },

  // Contract Addresses
  contracts: {
    npm: process.env.NPM_ADDRESS || '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657',
    startBlock: parseInt(process.env.START_BLOCK || '48000000', 10), // Flare mainnet NPM deployment
  },

  // Retry & Backoff
  retry: {
    maxAttempts: 5,
    initialDelayMs: 250,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    // Adaptive: reduce concurrency on repeated failures
    failureThreshold: 3, // consecutive failures before reducing concurrency
    successThreshold: 20, // consecutive successes before increasing concurrency
  },

  // Database Batching
  db: {
    batchSize: 200, // Events per transaction
    checkpointInterval: 50, // Update checkpoint every N batches
  },

  // Follower Mode (tail)
  follower: {
    pollIntervalMs: 12000, // Check for new blocks every 12s
    confirmationBlocks: 2, // Wait N blocks before considering finalized
    restartDelayMs: 5000, // Wait before restarting on error
  },

  // Events to Index
  events: {
    transfer: true, // ERC721 Transfer
    increaseLiquidity: true,
    decreaseLiquidity: true,
    collect: true,
  },

  // Logging
  logging: {
    progressIntervalMs: 60000, // Log metrics every 60s
    verboseDecoding: false, // Log every decoded event (dev only)
  },
};

export type IndexerConfig = typeof indexerConfig;

