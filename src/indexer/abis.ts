/**
 * ABIs and Event Signatures for NonfungiblePositionManager
 * 
 * Enosys/Uniswap-v3 compatible on Flare mainnet
 */

import { keccak256, toHex } from 'viem';

// ============================================================================
// Event Signatures (Topic0)
// ============================================================================

// ERC721 Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
export const TRANSFER_TOPIC = keccak256(toHex('Transfer(address,address,uint256)'));

// IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
export const INCREASE_LIQUIDITY_TOPIC = keccak256(toHex('IncreaseLiquidity(uint256,uint128,uint256,uint256)'));

// DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
export const DECREASE_LIQUIDITY_TOPIC = keccak256(toHex('DecreaseLiquidity(uint256,uint128,uint256,uint256)'));

// Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1)
export const COLLECT_TOPIC = keccak256(toHex('Collect(uint256,address,uint256,uint256)'));

// ============================================================================
// ABIs for Event Decoding
// ============================================================================

export const TRANSFER_ABI = {
  anonymous: false,
  inputs: [
    { indexed: true, name: 'from', type: 'address' },
    { indexed: true, name: 'to', type: 'address' },
    { indexed: true, name: 'tokenId', type: 'uint256' },
  ],
  name: 'Transfer',
  type: 'event',
} as const;

export const INCREASE_LIQUIDITY_ABI = {
  anonymous: false,
  inputs: [
    { indexed: true, name: 'tokenId', type: 'uint256' },
    { indexed: false, name: 'liquidity', type: 'uint128' },
    { indexed: false, name: 'amount0', type: 'uint256' },
    { indexed: false, name: 'amount1', type: 'uint256' },
  ],
  name: 'IncreaseLiquidity',
  type: 'event',
} as const;

export const DECREASE_LIQUIDITY_ABI = {
  anonymous: false,
  inputs: [
    { indexed: true, name: 'tokenId', type: 'uint256' },
    { indexed: false, name: 'liquidity', type: 'uint128' },
    { indexed: false, name: 'amount0', type: 'uint256' },
    { indexed: false, name: 'amount1', type: 'uint256' },
  ],
  name: 'DecreaseLiquidity',
  type: 'event',
} as const;

export const COLLECT_ABI = {
  anonymous: false,
  inputs: [
    { indexed: true, name: 'tokenId', type: 'uint256' },
    { indexed: false, name: 'recipient', type: 'address' },
    { indexed: false, name: 'amount0', type: 'uint256' },
    { indexed: false, name: 'amount1', type: 'uint256' },
  ],
  name: 'Collect',
  type: 'event',
} as const;

// Combined ABI for multi-event decoding
export const NPM_EVENTS_ABI = [
  TRANSFER_ABI,
  INCREASE_LIQUIDITY_ABI,
  DECREASE_LIQUIDITY_ABI,
  COLLECT_ABI,
] as const;

// Map topics to event types
export const TOPIC_TO_EVENT_TYPE: Record<string, 'TRANSFER' | 'INCREASE' | 'DECREASE' | 'COLLECT'> = {
  [TRANSFER_TOPIC]: 'TRANSFER',
  [INCREASE_LIQUIDITY_TOPIC]: 'INCREASE',
  [DECREASE_LIQUIDITY_TOPIC]: 'DECREASE',
  [COLLECT_TOPIC]: 'COLLECT',
};

// Helper to get topic array for getLogs
export function getEventTopics(config: {
  transfer?: boolean;
  increaseLiquidity?: boolean;
  decreaseLiquidity?: boolean;
  collect?: boolean;
}): string[] {
  const topics: string[] = [];
  if (config.transfer) topics.push(TRANSFER_TOPIC);
  if (config.increaseLiquidity) topics.push(INCREASE_LIQUIDITY_TOPIC);
  if (config.decreaseLiquidity) topics.push(DECREASE_LIQUIDITY_TOPIC);
  if (config.collect) topics.push(COLLECT_TOPIC);
  return topics;
}

