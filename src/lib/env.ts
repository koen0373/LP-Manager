type _EnvNumber = number | null;

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    console.warn(`[env] ${name} is not a valid integer. Using fallback=${fallback}.`);
    return fallback;
  }
  return parsed;
}

function parseBigIntEnv(name: string, fallback: bigint): bigint {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    return BigInt(raw);
  } catch {
    console.warn(`[env] ${name} is not a valid bigint. Using fallback=${fallback}.`);
    return fallback;
  }
}

function readStringEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return undefined;
  }
  return value.trim();
}

export const env = {
  rpcUrl:
    readStringEnv('NEXT_PUBLIC_RPC_URL') ??
    readStringEnv('FLARE_RPC_URL') ??
    'https://flare.flr.finance/ext/bc/C/rpc',
  discovery: {
    enosysIncentivesApi: readStringEnv('ENOSYS_INCENTIVES_API'),
    sparkdexIncentivesApi: readStringEnv('SPARKDEX_INCENTIVES_API'),
    enosysPositionManager: readStringEnv('ENOSYS_POSITION_MANAGER'),
    sparkdexPositionManager: readStringEnv('SPARKDEX_POSITION_MANAGER'),
    blazeswapPositionManager: readStringEnv('BLAZESWAP_POSITION_MANAGER'),
    fromBlock: parseBigIntEnv('DISCOVERY_FROM_BLOCK', 0n),
    maxBlockRange: BigInt(parseIntEnv('DISCOVERY_MAX_BLOCK_RANGE', 50_000)),
    maxWallets: parseIntEnv('DISCOVERY_MAX_WALLETS', 5_000),
    minScore: parseIntEnv('DISCOVERY_MIN_SCORE', 1),
  },
};

export type ProviderKey = 'enosys-v3' | 'sparkdex-v3' | 'blazeswap-v3';
