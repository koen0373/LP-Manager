import { providers } from 'ethers';

export const FLARE_CHAIN_ID = 14;
const DEFAULT_FLARE_RPC = 'https://flare-api.flare.network/ext/C/rpc';

export function getFlareRpcUrl(): string {
  if (typeof process !== 'undefined') {
    const fromEnv =
      process.env.FLARE_RPC_URL ??
      process.env.NEXT_PUBLIC_FLARE_RPC_URL ??
      process.env.RPC_URL;
    if (fromEnv && fromEnv.trim().length > 0) {
      return fromEnv.trim();
    }
  }
  return DEFAULT_FLARE_RPC;
}

export function makeProvider(): providers.JsonRpcProvider {
  const rpcUrl = getFlareRpcUrl();
  return new providers.JsonRpcProvider(rpcUrl, FLARE_CHAIN_ID);
}
