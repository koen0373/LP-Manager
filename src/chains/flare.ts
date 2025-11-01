import {
  createPublicClient,
  defineChain,
  http,
  type HttpTransport,
  type PublicClient,
} from 'viem';

const DEFAULT_FLARE_RPC = 'https://flare-api.flare.network/ext/C/rpc';

/**
 * Minimal Flare L1 chain descriptor for viem clients.
 * Keep this in sync if Flare upgrades RPC or native currency metadata.
 */
export const flareChain = defineChain({
  id: 14,
  name: 'Flare',
  nativeCurrency: {
    name: 'Flare',
    symbol: 'FLR',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [DEFAULT_FLARE_RPC],
    },
    public: {
      http: [DEFAULT_FLARE_RPC],
    },
  },
  blockExplorers: {
    default: {
      name: 'FlareScan',
      url: 'https://flare.space',
    },
  },
});

export type FlareClient = PublicClient<HttpTransport, typeof flareChain>;

export function getFlareRpcUrl(): string {
  const candidates = [
    process.env.FLARE_RPC_URL,
    process.env.NEXT_PUBLIC_FLARE_RPC_URL,
    process.env.NEXT_PUBLIC_RPC_URL,
    process.env.RPC_URL,
  ];

  for (const value of candidates) {
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  return DEFAULT_FLARE_RPC;
}

export function createFlareClient(rpcUrl = getFlareRpcUrl()): FlareClient {
  return createPublicClient({
    chain: flareChain,
    transport: http(rpcUrl),
  });
}

let cachedClient: FlareClient | null = null;

export function getFlareClient(): FlareClient {
  if (!cachedClient) {
    cachedClient = createFlareClient();
  }
  return cachedClient;
}

/**
 * Backwards compatible export used across server utilities that expect
 * a ready-to-use viem public client.
 */
export const flare = getFlareClient();
