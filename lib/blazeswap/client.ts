import { providers, Contract, Signer } from 'ethers';
import type { ExternalProvider } from '@ethersproject/providers';

import RouterABI from '../abi/blazeswap/IBlazeSwapRouter.json';
import FactoryABI from '../abi/uniswapV2Factory.json';
import PairABI from '../abi/uniswapV2Pair.json';
import { ERC20_ABI } from '@/lib/onchain/abis';

// Constants
const FLARE_CHAIN_ID = 14;

export const BLAZESWAP_ROUTER_ADDRESS =
  '0xe3A1b355ca63abCBC9589334B5e609583C7BAa06';

type SignerLike = Signer | providers.Web3Provider;

declare global {
  interface Window {
    ethereum?: ExternalProvider;
  }
}

export async function getBrowserProvider(): Promise<providers.Web3Provider> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Wallet not available in this environment.');
  }
  const ethereumProvider = window.ethereum as ExternalProvider;
  return new providers.Web3Provider(ethereumProvider, FLARE_CHAIN_ID);
}

export async function getSigner(): Promise<Signer> {
  const provider = await getBrowserProvider();
  const signer = provider.getSigner();
  return signer;
}

export function getRouterContract<T extends Contract = Contract>(
  signerOrProvider: SignerLike,
): T {
  return new Contract(
    BLAZESWAP_ROUTER_ADDRESS,
    RouterABI,
    signerOrProvider,
  ) as T;
}

export function getFactoryContract<T extends Contract = Contract>(
  address: string,
  signerOrProvider: SignerLike,
): T {
  return new Contract(address, FactoryABI, signerOrProvider) as T;
}

export function getPairContract<T extends Contract = Contract>(
  address: string,
  signerOrProvider: SignerLike,
): T {
  return new Contract(address, PairABI, signerOrProvider) as T;
}

export function getErc20Contract<T extends Contract = Contract>(
  token: string,
  signerOrProvider: SignerLike,
): T {
  return new Contract(token, ERC20_ABI, signerOrProvider) as T;
}

export async function getAllowance(
  token: string,
  owner: string,
  spender: string,
): Promise<bigint> {
  const provider = await getBrowserProvider();
  const contract = getErc20Contract(token, provider);
  const allowance: bigint = await contract.allowance(owner, spender);
  return allowance;
}
