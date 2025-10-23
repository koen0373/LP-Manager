import { keccak256, toHex } from 'viem';
import { createClientWithFallback } from '../lib/adapters/clientFactory';

const REGISTRY = '0xaD67FE666660Fb8dFE9d6b1b4240d8650e30F6019' as const;

const registryAbi = [
  'function getContractAddress(string name) view returns (address)',
  'function getContractAddressByHash(bytes32 nameHash) view returns (address)',
  'function contracts(string name) view returns (address)',
  'function contracts(bytes32 nameHash) view returns (address)',
];

const CANDIDATE_KEYS = [
  'IncentivesController',
  'RewardsDistributor',
  'Incentives',
  'FarmingManager',
  'LiquidityMining',
];

async function resolveRewardsAddress(): Promise<`0x${string}`> {
  const client = createClientWithFallback([
    process.env.NEXT_PUBLIC_RPC_URL ?? 'https://flare.flr.finance/ext/bc/C/rpc',
    'https://flare.public-rpc.com',
  ]);

  for (const key of CANDIDATE_KEYS) {
    // 1) probeer string getters
    for (const fn of ['getContractAddress', 'contracts'] as const) {
      try {
        const addr = await client.readContract({
          address: REGISTRY,
          abi: registryAbi,
          functionName: fn,
          args: [key],
        }) as `0x${string}`;
        if (addr && addr !== '0x0000000000000000000000000000000000000000') return addr;
      } catch {}
    }
    // 2) probeer bytes32 varianten
    const h = keccak256(toHex(key, { size: undefined })); // hash van string
    for (const fn of ['getContractAddressByHash', 'contracts'] as const) {
      try {
        const addr = await client.readContract({
          address: REGISTRY,
          abi: registryAbi,
          functionName: fn,
          args: [h],
        }) as `0x${string}`;
        if (addr && addr !== '0x0000000000000000000000000000000000000000') return addr;
      } catch {}
    }
  }
  throw new Error('Rewards/Incentives contract niet gevonden in registry');
}

// Cache voor rewards contract address
let rewardsContractAddress: `0x${string}` | null = null;

async function getRewardsContractAddress(): Promise<`0x${string}`> {
  if (!rewardsContractAddress) {
    rewardsContractAddress = await resolveRewardsAddress();
  }
  return rewardsContractAddress;
}

// ABI voor rewards contract - we moeten dit aanpassen op basis van wat we vinden
const rewardsAbi = [
  'function getRewardAmount(address user, address token) view returns (uint256)',
  'function pendingRewards(address user, address token) view returns (uint256)',
  'function getUserReward(address user, address token) view returns (uint256)',
  'function rewards(address user, address token) view returns (uint256)',
  'function earned(address user, address token) view returns (uint256)',
];

// APS token address
const APS_TOKEN_ADDRESS = '0xfF56Eb5b1a7FAa972291117E5E9565dA29bc808d' as const;

export async function getApsRewardForPosition(positionId: string): Promise<number | null> {
  try {
    const rewardsContract = await getRewardsContractAddress();
    const client = createClientWithFallback([
      process.env.NEXT_PUBLIC_RPC_URL ?? 'https://flare.flr.finance/ext/bc/C/rpc',
      'https://flare.public-rpc.com',
    ]);

    // Probeer verschillende functies om APS rewards te krijgen
    const functions: (
      | 'getRewardAmount'
      | 'pendingRewards'
      | 'getUserReward'
      | 'rewards'
      | 'earned'
    )[] = ['getRewardAmount', 'pendingRewards', 'getUserReward', 'rewards', 'earned'];

    const readArgs = [positionId, APS_TOKEN_ADDRESS] as const;

    for (const fn of functions) {
      try {
        const reward = await client.readContract({
          address: rewardsContract,
          abi: rewardsAbi,
          functionName: fn,
          args: readArgs,
        }) as bigint;
        
        if (reward && reward > 0) {
          // Convert from wei to token units (APS has 18 decimals)
          return Number(reward) / 1e18;
        }
      } catch (error) {
        console.warn(`[APS] Function ${fn} failed:`, error);
      }
    }

    return null;
  } catch (error) {
    console.error('[APS] Error fetching APS rewards:', error);
    return null;
  }
}

export function clearApsRewardCache(): void {
  rewardsContractAddress = null;
}
