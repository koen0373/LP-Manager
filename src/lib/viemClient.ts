import { createPublicClient, http } from 'viem';
import { flare } from 'viem/chains';

export const publicClient = createPublicClient({
  chain: flare,
  transport: http('https://flare.flr.finance/ext/bc/C/rpc'),
});
