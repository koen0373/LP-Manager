import { createPublicClient, http, defineChain } from 'viem';

export const flare = defineChain({
  id: 14,
  name: 'Flare',
  nativeCurrency: { name: 'Flare', symbol: 'FLR', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://flare-api.flare.network/ext/C/rpc'] },
    public:  { http: ['https://flare-api.flare.network/ext/C/rpc'] },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 0,
    },
  },
});

export const publicClient = createPublicClient({
  chain: flare,
  transport: http(flare.rpcUrls.default.http[0]),
  batch: { multicall: false }, // Disable multicall for Flare network
});
