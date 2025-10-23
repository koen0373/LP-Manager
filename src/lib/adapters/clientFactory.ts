import { createPublicClient, fallback, http } from 'viem';
import { flare } from '../chainFlare';

const DEFAULT_ENDPOINTS = [
  'https://flare.flr.finance/ext/bc/C/rpc',
  'https://flare.public-rpc.com',
  'https://rpc.ftso.com',
];

const endpoints = process.env.NEXT_PUBLIC_RPC_URL
  ? [process.env.NEXT_PUBLIC_RPC_URL, ...DEFAULT_ENDPOINTS]
  : DEFAULT_ENDPOINTS;

export const defaultClient = createPublicClient({
  chain: flare,
  transport: fallback(endpoints.map((url) => http(url, { batch: { wait: 20 } }))),
  batch: { multicall: false },
});

export function createClientWithFallback(customEndpoints?: string[]) {
  const resolved = customEndpoints && customEndpoints.length > 0 ? customEndpoints : endpoints;
  return createPublicClient({
    chain: flare,
    transport: fallback(resolved.map((url) => http(url, { batch: { wait: 20 } }))),
    batch: { multicall: false },
  });
}
