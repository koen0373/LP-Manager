import { createPublicClient, http } from 'viem';
import { flare } from 'viem/chains';

import { env } from '@/lib/env';

export const publicClient = createPublicClient({
  chain: flare,
  transport: http(env.rpcUrl),
});
