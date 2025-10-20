import { createConfig, http } from 'wagmi';
import { metaMask, walletConnect, coinbaseWallet } from '@wagmi/connectors';
import { flare } from './viemClient';

export const config = createConfig({
  chains: [flare],
  connectors: [
    metaMask({
      dappMetadata: {
        name: 'Enosys LP Manager',
        url: 'https://enosys-lp-manager-v2.vercel.app',
      },
    }),
    walletConnect({
      projectId: 'your-project-id', // You can get this from WalletConnect Cloud
    }),
    coinbaseWallet({
      appName: 'Enosys LP Manager',
    }),
  ],
  transports: {
    [flare.id]: http(),
  },
});
