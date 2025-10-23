import { createPublicClient, http } from 'viem';

export const flare = createPublicClient({
  chain: {
    id: 14,
    name: 'Flare',
    nativeCurrency: { name: 'FLR', symbol: 'FLR', decimals: 18 },
    rpcUrls: {
      default: {
        http: ['https://flare.flr.finance/ext/bc/C/rpc']
      }
    }
  },
  transport: http(),
  batch: { multicall: false }
});
