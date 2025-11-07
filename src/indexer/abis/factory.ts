import { keccak256, toHex } from 'viem';

export const CREATE_POOL_EVENT_ABI = {
  anonymous: false,
  inputs: [
    { indexed: true, name: 'token0', type: 'address' },
    { indexed: true, name: 'token1', type: 'address' },
    { indexed: true, name: 'fee', type: 'uint24' },
    { indexed: false, name: 'tickSpacing', type: 'int24' },
    { indexed: false, name: 'pool', type: 'address' },
  ],
  name: 'CreatePool',
  type: 'event',
} as const;

export const POOL_CREATED_EVENT_ABI = {
  anonymous: false,
  inputs: [
    { indexed: true, name: 'token0', type: 'address' },
    { indexed: true, name: 'token1', type: 'address' },
    { indexed: true, name: 'fee', type: 'uint24' },
    { indexed: false, name: 'tickSpacing', type: 'int24' },
    { indexed: false, name: 'pool', type: 'address' },
  ],
  name: 'PoolCreated',
  type: 'event',
} as const;

export const FACTORY_EVENTS_ABI = [
  CREATE_POOL_EVENT_ABI,
  POOL_CREATED_EVENT_ABI,
] as const;

export type FactoryEventName = 'CreatePool' | 'PoolCreated';

export const CREATE_POOL_TOPIC = keccak256(
  toHex('CreatePool(address,address,uint24,int24,address)')
);
export const POOL_CREATED_TOPIC = keccak256(
  toHex('PoolCreated(address,address,uint24,int24,address)')
);

export const FACTORY_EVENT_TOPICS = [CREATE_POOL_TOPIC, POOL_CREATED_TOPIC];
