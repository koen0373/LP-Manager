import { http, createConfig } from 'wagmi';
import { flare } from 'wagmi/chains';

export const config = createConfig({
  chains: [flare],
  transports: {
    [flare.id]: http(),
  },
});
