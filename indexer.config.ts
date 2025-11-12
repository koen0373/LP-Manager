/**
 * Indexer Configuration with Env Overrides
 * 
 * Production-grade settings for the Liqui blockchain indexer.
 * Supports RPS throttling, adaptive concurrency, ANKR cost tracking.
 */

import * as fs from 'fs';
import path from 'path';

export interface IndexerConfig {
  rpc: {
    url: string;
    batchSize: number;
    maxConcurrency: number;
    minConcurrency: number;
    requestTimeout: number;
    rps: number;
    concurrency: number;
    blockWindow: number;
  };
  contracts: {
    npm: string | string[]; // Single NFPM or array of NFPMs
    startBlock: number;
    factories: {
      enosys: string;
      sparkdex: string;
    };
  };
  retry: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    failureThreshold: number;
    successThreshold: number;
  };
  db: {
    batchSize: number;
    checkpointInterval: number;
  };
  follower: {
    pollIntervalMs: number;
    confirmationBlocks: number;
    restartDelayMs: number;
  };
  events: {
    transfer: boolean;
    increaseLiquidity: boolean;
    decreaseLiquidity: boolean;
    collect: boolean;
  };
  logging: {
    progressIntervalMs: number;
    verboseDecoding: boolean;
  };
  cost: {
    creditPerUsd: number;
    weights?: Record<string, number>;
  };
  allowlist: {
    enabled: boolean;
    path: string;
  };
}

const BASE_CONFIG: IndexerConfig = {
  rpc: {
    url: process.env.FLARE_RPC_URL || 'https://flare-api.flare.network/ext/bc/C/rpc',
    batchSize: 1000,
    maxConcurrency: 12,
    minConcurrency: 4,
    requestTimeout: 30000,
    rps: 6,
    concurrency: 6,
    // Flare RPC limit: 30 blocks max per eth_getLogs. Use 25 for safety margin.
    blockWindow: parseInt(process.env.INDEXER_BLOCK_WINDOW || '25', 10),
  },
  contracts: {
    npm: [
      process.env.ENOSYS_NFPM || '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657',
      process.env.SPARKDEX_NFPM || '0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da',
    ],
    startBlock: 48500000,
    factories: {
      enosys: process.env.ENOSYS_V3_FACTORY || '0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de',
      sparkdex: process.env.SPARKDEX_V3_FACTORY || '0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652',
    },
  },
  retry: {
    maxAttempts: 5,
    initialDelayMs: 250,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    failureThreshold: 3,
    successThreshold: 20,
  },
  db: {
    batchSize: 1000,
    checkpointInterval: 25,
  },
  follower: {
    pollIntervalMs: 12000,
    confirmationBlocks: 2,
    restartDelayMs: 5000,
  },
  events: {
    transfer: true,
    increaseLiquidity: true,
    decreaseLiquidity: true,
    collect: true,
  },
  logging: {
    progressIntervalMs: 60000,
    verboseDecoding: false,
  },
  cost: {
    creditPerUsd: 10_000_000,
    weights: undefined,
  },
  allowlist: {
    enabled: false,
    path: 'data/config/pools.allowlist.json',
  },
};

function loadCostWeights(): Record<string, number> | undefined {
  const json = process.env.COST_WEIGHTS_JSON;
  if (!json) return undefined;
  
  try {
    // Try as file path first
    if (json.startsWith('{')) {
      return JSON.parse(json);
    }
    if (fs.existsSync(json)) {
      return JSON.parse(fs.readFileSync(json, 'utf8'));
    }
    
    return JSON.parse(json);
  } catch (_error) {
    console.warn('[config] Invalid COST_WEIGHTS_JSON, using defaults');
    return undefined;
  }
}

export function loadIndexerConfigFromEnv(overrides?: Partial<IndexerConfig>): IndexerConfig {
  const rps = parseInt(process.env.INDEXER_RPS || '6', 10);
  const concurrency = parseInt(process.env.INDEXER_CONCURRENCY || '6', 10);
  // Flare RPC limit: 30 blocks max. Default to 25 for safety (matches BASE_CONFIG).
  const blockWindow = parseInt(process.env.INDEXER_BLOCK_WINDOW || '25', 10);
  const creditPerUsd = parseInt(process.env.CREDIT_PER_USD || '10000000', 10);
  const allowlistPath = process.env.POOLS_ALLOWLIST || 'data/config/pools.allowlist.json';
  
  const costWeights = loadCostWeights();
  
  const allowlistEnabled = fs.existsSync(path.join(process.cwd(), allowlistPath));

  const config: IndexerConfig = {
    ...BASE_CONFIG,
    rpc: {
      ...BASE_CONFIG.rpc,
      rps,
      concurrency,
      blockWindow,
      ...(overrides?.rpc ?? {}),
    },
    cost: {
      creditPerUsd,
      weights: costWeights,
      ...(overrides?.cost ?? {}),
    },
    allowlist: {
      enabled: allowlistEnabled,
      path: allowlistPath,
    },
    ...(overrides ?? {}),
  };

  return config;
}

// Legacy export for backward compatibility
export const indexerConfig = loadIndexerConfigFromEnv();

export type IndexerConfigType = typeof indexerConfig;
