import { injected } from 'wagmi/connectors';
import { cookieStorage, createConfig, createStorage, http } from 'wagmi';
import { flare } from 'wagmi/chains';

export const config = createConfig({
  chains: [flare],
  transports: {
    [flare.id]: http(),
  },
  connectors: [
    injected({ shimDisconnect: true }),
  ],
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
});

export function getConfig() {
  return config;
}
