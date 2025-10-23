import { defineChain } from 'viem';

export const flare = defineChain({
  id: 14,
  name: 'Flare',
  nativeCurrency: {
    decimals: 18,
    name: 'Flare',
    symbol: 'FLR',
  },
  rpcUrls: {
    default: {
      http: [
        'https://flare.flr.finance/ext/bc/C/rpc',
        'https://flare.public-rpc.com',
      ],
    },
    public: {
      http: [
        'https://flare.flr.finance/ext/bc/C/rpc',
        'https://flare.public-rpc.com',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'FlareScan',
      url: 'https://flare.space',
    },
  },
  testnet: false,
});
