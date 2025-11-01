import {
  Signer,
  constants,
  BigNumber,
} from 'ethers';
import { parseUnits } from 'ethers/lib/utils';
import type { ContractTransaction } from 'ethers';

import { ERC20_ABI as _ERC20_ABI } from '@/lib/onchain/abis';
import {
  BLAZESWAP_ROUTER_ADDRESS,
  getBrowserProvider,
  getErc20Contract,
  getRouterContract,
} from '@/lib/blazeswap/client';

export type AddLiquidityParams = {
  tokenA: {
    address: string;
    decimals: number;
    amountDesired: string;
    amountMin: string;
  };
  tokenB: {
    address: string;
    decimals: number;
    amountDesired: string;
    amountMin: string;
  };
  to: string;
  deadline?: number;
};

export type RemoveLiquidityParams = {
  pairAddress: string;
  liquidity: string;
  pairDecimals: number;
  tokenA: { address: string; decimals: number; amountMin: string };
  tokenB: { address: string; decimals: number; amountMin: string };
  to: string;
  deadline?: number;
};

function toDeadline(secondsFromNow = 1_200): number {
  return Math.floor(Date.now() / 1000) + secondsFromNow;
}

async function waitForReceipt(
  tx: ContractTransaction,
): Promise<string> {
  const receipt = await tx.wait();
  return receipt?.transactionHash ?? tx.hash;
}

export async function ensureAllowance(
  token: string,
  owner: string,
  spender: string,
  minimumAmount: BigNumber,
  signer?: Signer,
): Promise<string | null> {
  const signerToUse =
    signer ?? (await (await getBrowserProvider()).getSigner());
  const erc20 = getErc20Contract(token, signerToUse);
  const currentAllowance: BigNumber = await erc20.allowance(owner, spender);
  if (currentAllowance.gte(minimumAmount)) {
    return null;
  }
  const tx = await erc20.approve(spender, constants.MaxUint256);
  return waitForReceipt(tx);
}

export async function addLiquidity(
  params: AddLiquidityParams,
  signer?: Signer,
): Promise<string> {
  const signerToUse =
    signer ?? (await (await getBrowserProvider()).getSigner());

  const parsedAmountA = parseUnits(
    params.tokenA.amountDesired,
    params.tokenA.decimals,
  );
  const parsedAmountB = parseUnits(
    params.tokenB.amountDesired,
    params.tokenB.decimals,
  );
  const parsedMinA = parseUnits(
    params.tokenA.amountMin,
    params.tokenA.decimals,
  );
  const parsedMinB = parseUnits(
    params.tokenB.amountMin,
    params.tokenB.decimals,
  );

  await ensureAllowance(
    params.tokenA.address,
    params.to,
    BLAZESWAP_ROUTER_ADDRESS,
    parsedAmountA,
    signerToUse,
  );
  await ensureAllowance(
    params.tokenB.address,
    params.to,
    BLAZESWAP_ROUTER_ADDRESS,
    parsedAmountB,
    signerToUse,
  );

  const router = getRouterContract(signerToUse);
  const deadline = params.deadline ?? toDeadline();
  const tx = await router.addLiquidity(
    params.tokenA.address,
    params.tokenB.address,
    parsedAmountA,
    parsedAmountB,
    parsedMinA,
    parsedMinB,
    params.to,
    deadline,
  );

  return waitForReceipt(tx);
}

export async function removeLiquidity(
  params: RemoveLiquidityParams,
  signer?: Signer,
): Promise<string> {
  const signerToUse =
    signer ?? (await (await getBrowserProvider()).getSigner());

  const liquidityAmount = parseUnits(
    params.liquidity,
    params.pairDecimals,
  );
  await ensureAllowance(
    params.pairAddress,
    params.to,
    BLAZESWAP_ROUTER_ADDRESS,
    liquidityAmount,
    signerToUse,
  );

  const router = getRouterContract(signerToUse);
  const deadline = params.deadline ?? toDeadline();
  const amountAMin = parseUnits(
    params.tokenA.amountMin,
    params.tokenA.decimals,
  );
  const amountBMin = parseUnits(
    params.tokenB.amountMin,
    params.tokenB.decimals,
  );

  const tx = await router.removeLiquidity(
    params.tokenA.address,
    params.tokenB.address,
    liquidityAmount,
    amountAMin,
    amountBMin,
    params.to,
    deadline,
  );

  return waitForReceipt(tx);
}
