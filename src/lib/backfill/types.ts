// Backfill types and interfaces

export interface BackfillOptions {
  tokenIds?: number[];
  mode?: 'full' | 'since';
  sinceBlock?: number;
  concurrency?: number;
  batchSize?: number;
}

export interface BackfillResult {
  tokenId: number;
  success: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  lastBlock: number;
  elapsedMs: number;
  error?: string;
}

export interface BackfillSummary {
  total: number;
  successful: number;
  failed: number;
  totalInserted: number;
  totalUpdated: number;
  totalSkipped: number;
  totalElapsedMs: number;
  results: BackfillResult[];
}

export interface FlarescanTransfer {
  from: {
    hash: string;
  };
  to: {
    hash: string;
  };
  block_number: number;
  transaction_hash: string;
  log_index: number;
  timestamp: string;
}

export interface FlarescanLog {
  address: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  data: string;
  topics: string[];
  timestamp: string;
}

