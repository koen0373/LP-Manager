/**
 * SparkDEX TokenDistributor ABI
 * 
 * Contract: 0xc2DF11C68f86910B99EAf8acEd7F5189915Ba24F
 * Handles both SPX and rFLR reward distributions
 */

// Common reward distribution events
export const TOKEN_DISTRIBUTOR_ABI = [
  // RewardDistributed event (generic)
  {
    type: 'event',
    name: 'RewardDistributed',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  // Claimed event
  {
    type: 'event',
    name: 'Claimed',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  // RewardAdded event (when rewards are added to pool)
  {
    type: 'event',
    name: 'RewardAdded',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  // Transfer event (ERC20 standard - rewards paid out)
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const;

// Read functions for current reward rates
export const TOKEN_DISTRIBUTOR_READ_ABI = [
  {
    type: 'function',
    name: 'rewardRate',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalRewards',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'claimable',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

