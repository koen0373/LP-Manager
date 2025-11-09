/**
 * Staking Contract Configuration
 * 
 * Update deze file met de juiste contract addresses zodra bekend.
 */

export interface StakingContractConfig {
  address: string;
  dex: 'enosys-v3' | 'sparkdex-v3';
  type: 'masterchef' | 'gauge' | 'custom';
  rewardToken: string;        // Address van reward token
  rewardTokenSymbol?: string;
  startBlock: number;         // Block waar staking begon
  poolMapping?: {             // Mapping van farm PID → LP pool address
    [pid: string]: string;
  };
}

export const STAKING_CONTRACTS: StakingContractConfig[] = [
  // ENOSYS STAKING (PLACEHOLDER - moet worden ingevuld)
  // {
  //   address: '0x...', // Enosys MasterChef/Farm contract
  //   dex: 'enosys-v3',
  //   type: 'masterchef',
  //   rewardToken: '0x...', // ENOSYS token address
  //   rewardTokenSymbol: 'ENOSYS',
  //   startBlock: 29_837_200,
  //   poolMapping: {
  //     '0': '0x686f53F0950Ef193C887527eC027E6A574A4DbE1', // PID 0 = FXRP-USDT pool
  //     // ... meer mappings
  //   }
  // },

  // SPARKDEX STAKING (PLACEHOLDER - moet worden ingevuld)
  // {
  //   address: '0x...', // SparkDEX Farm contract
  //   dex: 'sparkdex-v3',
  //   type: 'masterchef',
  //   rewardToken: '0x...', // SPARK token address?
  //   rewardTokenSymbol: 'SPARK',
  //   startBlock: 29_837_200,
  // },
];

/**
 * Helper: Find staking config by contract address
 */
export function getStakingConfig(address: string): StakingContractConfig | undefined {
  return STAKING_CONTRACTS.find(
    (c) => c.address.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Helper: Get pool address from staking event metadata
 */
export function resolvePoolFromStakingEvent(
  config: StakingContractConfig,
  eventName: string,
  decodedArgs: Record<string, any>
): string | null {
  // For MasterChef: use PID to lookup pool
  if (config.type === 'masterchef' && 'pid' in decodedArgs) {
    const pid = String(decodedArgs.pid);
    return config.poolMapping?.[pid] || null;
  }

  // For Gauge: pool address is usually the gauge contract itself
  if (config.type === 'gauge') {
    // Gauge contracts usually have 1:1 mapping with LP tokens
    // May need on-chain read: gauge.stakingToken()
    return null; // Implement later with on-chain read
  }

  return null;
}

