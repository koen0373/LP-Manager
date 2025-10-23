/**
 * FlareScan API Types
 * Type definitions for Blockscout/Etherscan-compatible API responses
 */

export type FlarescanStatus = '0' | '1';

export type FlarescanResponse<T = unknown> = {
  status: FlarescanStatus;
  message: string;
  result: T;
};

// Contract creation
export type ContractCreationResult = {
  contractAddress: string;
  contractCreator: string;
  txHash: string;
}[];

// Transaction info
export type TransactionInfoResult = {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  value: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
  isError?: string;
  txreceipt_status?: string;
};

// NFT transfers
export type NFTTransferResult = {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  tokenID: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
}[];

// Event logs
export type LogResult = {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  blockHash: string;
  timeStamp: string;
  gasPrice: string;
  gasUsed: string;
  logIndex: string;
  transactionHash: string;
  transactionIndex: string;
}[];

// Blockscout REST v2 types
export type BlockscoutContractInfo = {
  address: {
    hash: string;
    name: string | null;
  };
  creation_transaction_hash: string | null;
  creation_block_hash: string | null;
  deployed_bytecode: string | null;
  abi: unknown[] | null;
  compiler_version: string | null;
  optimization_enabled: boolean | null;
  optimization_runs: number | null;
  evm_version: string | null;
  verified: boolean;
};

export type BlockscoutTransaction = {
  hash: string;
  block_number: number;
  timestamp: string;
  from: {
    hash: string;
  };
  to: {
    hash: string;
  };
  value: string;
  gas_used: string;
  gas_price: string;
  status: 'ok' | 'error';
  confirmations: number;
};

export type BlockscoutNFTTransfer = {
  from: {
    hash: string;
  };
  to: {
    hash: string;
  };
  token_id: string;
  timestamp: string;
  tx_hash: string;
  block_number: number;
  log_index: number;
};

export type BlockscoutLog = {
  address: {
    hash: string;
  };
  topics: string[];
  data: string;
  block_number: number;
  block_hash: string;
  tx_hash: string;
  index: number;
  decoded?: {
    method_call: string;
    method_id: string;
    parameters: Array<{
      name: string;
      type: string;
      value: string | number | boolean;
    }>;
  };
};

// Normalized types (internal)
export type NormalizedTransfer = {
  from: string;
  to: string;
  tokenId: string;
  timestamp: number;
  txHash: string;
  blockNumber: number;
  logIndex: number;
};

export type NormalizedLog = {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  timestamp?: number;
};

