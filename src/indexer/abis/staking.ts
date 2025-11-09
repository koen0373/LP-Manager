/**
 * Common staking/farm contract ABIs
 * Supports MasterChef-style contracts (Uniswap V2 farms)
 */

// Standard MasterChef/Farm events
export const STAKING_EVENTS_ABI = [
  // Deposit event: user stakes LP tokens
  {
    type: 'event',
    name: 'Deposit',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'pid', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  // Withdraw event: user unstakes LP tokens
  {
    type: 'event',
    name: 'Withdraw',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'pid', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  // EmergencyWithdraw event
  {
    type: 'event',
    name: 'EmergencyWithdraw',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'pid', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  // RewardPaid event (some contracts emit this)
  {
    type: 'event',
    name: 'RewardPaid',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'reward', type: 'uint256', indexed: false },
    ],
  },
  // Harvest event (alternative name)
  {
    type: 'event',
    name: 'Harvest',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'pid', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// MasterChef read functions (for pool info)
export const MASTERCHEF_READ_ABI = [
  {
    type: 'function',
    name: 'poolInfo',
    stateMutability: 'view',
    inputs: [{ name: 'pid', type: 'uint256' }],
    outputs: [
      { name: 'lpToken', type: 'address' },
      { name: 'allocPoint', type: 'uint256' },
      { name: 'lastRewardBlock', type: 'uint256' },
      { name: 'accRewardPerShare', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'rewardPerBlock',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalAllocPoint',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'poolLength',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// Gauge-style staking (Curve/Velodrome pattern)
export const GAUGE_EVENTS_ABI = [
  {
    type: 'event',
    name: 'Staked',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Withdrawn',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RewardPaid',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'rewardsToken', type: 'address', indexed: true },
      { name: 'reward', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RewardAdded',
    inputs: [
      { name: 'reward', type: 'uint256', indexed: false },
    ],
  },
] as const;

