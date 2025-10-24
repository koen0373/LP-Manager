/**
 * On-chain Readers
 * Pure read-only functions for fetching blockchain state
 */

import { type Address } from 'viem';
import { publicClient } from './client';
import {
  ERC20_ABI,
  FACTORY_ABI,
  POOL_ABI,
} from './abis';
import NonfungiblePositionManagerABI from '../../abis/NonfungiblePositionManager.json';
import { ENOSYS_ADDRESSES, CACHE_TTL } from './config';
import { memoize } from '../util/memo';
import { withTimeout } from '../util/withTimeout';

/**
 * Read token metadata (symbol, name, decimals)
 */
export async function readTokenMetadata(tokenAddress: Address): Promise<{
  symbol: string;
  name: string;
  decimals: number;
}> {
  return memoize(`token-metadata-${tokenAddress}`, async () => {
    try {
      const [symbol, name, decimals] = await Promise.all([
        withTimeout(
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'symbol',
          }),
          10000,
          'Token symbol read timeout'
        ).catch(() => 'UNKNOWN'),
        
        withTimeout(
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'name',
          }),
          10000,
          'Token name read timeout'
        ).catch(() => 'Unknown Token'),
        
        withTimeout(
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'decimals',
          }),
          10000,
          'Token decimals read timeout'
        ).catch(() => 18),
      ]);

      return {
        symbol: String(symbol),
        name: String(name),
        decimals: Number(decimals),
      };
    } catch (error) {
      console.error(`[ONCHAIN] Failed to read token metadata for ${tokenAddress}:`, error);
      return { symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 18 };
    }
  }, CACHE_TTL.TOKEN_METADATA);
}

/**
 * Read position data from NonfungiblePositionManager
 */
export async function readPositionData(tokenId: bigint): Promise<{
  nonce: bigint;
  operator: Address;
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
} | null> {
  try {
    const result = await withTimeout(
      publicClient.readContract({
        address: ENOSYS_ADDRESSES.POSITION_MANAGER,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: NonfungiblePositionManagerABI as any,
        functionName: 'positions',
        args: [tokenId],
      }),
      15000,
      'Position read timeout'
    );

    // result is a tuple: [nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, ...]
    const resultArray = result as unknown[];
    const [
      nonce,
      operator,
      token0,
      token1,
      fee,
      tickLower,
      tickUpper,
      liquidity,
      feeGrowthInside0LastX128,
      feeGrowthInside1LastX128,
      tokensOwed0,
      tokensOwed1,
    ] = resultArray;

    return {
      nonce: BigInt(nonce as bigint | string | number),
      operator: operator as Address,
      token0: token0 as Address,
      token1: token1 as Address,
      fee: Number(fee),
      tickLower: Number(tickLower),
      tickUpper: Number(tickUpper),
      liquidity: BigInt(liquidity as bigint | string | number),
      feeGrowthInside0LastX128: BigInt(feeGrowthInside0LastX128 as bigint | string | number),
      feeGrowthInside1LastX128: BigInt(feeGrowthInside1LastX128 as bigint | string | number),
      tokensOwed0: BigInt(tokensOwed0 as bigint | string | number),
      tokensOwed1: BigInt(tokensOwed1 as bigint | string | number),
    };
  } catch (error) {
    console.error(`[ONCHAIN] Failed to read position ${tokenId}:`, error);
    return null;
  }
}

/**
 * Get pool address from factory
 */
export async function readPoolAddress(
  token0: Address,
  token1: Address,
  fee: number
): Promise<Address | null> {
  return memoize(`pool-address-${token0}-${token1}-${fee}`, async () => {
    try {
      const poolAddress = await withTimeout(
        publicClient.readContract({
          address: ENOSYS_ADDRESSES.FACTORY,
          abi: FACTORY_ABI,
          functionName: 'getPool',
          args: [token0, token1, fee],
        }),
        10000,
        'Pool address read timeout'
      );

      return poolAddress as Address;
    } catch (error) {
      console.error(`[ONCHAIN] Failed to read pool address for ${token0}/${token1}/${fee}:`, error);
      return null;
    }
  }, CACHE_TTL.TOKEN_METADATA); // Long TTL since pool addresses don't change
}

/**
 * Read pool slot0 (current price, tick, etc.)
 */
export async function readPoolSlot0(poolAddress: Address): Promise<{
  sqrtPriceX96: bigint;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
  unlocked: boolean;
} | null> {
  try {
    const result = await withTimeout(
      publicClient.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'slot0',
      }),
      10000,
      'Pool slot0 read timeout'
    );

    const resultArray = result as unknown as unknown[];
    const [sqrtPriceX96, tick, observationIndex, observationCardinality, observationCardinalityNext, feeProtocol, unlocked] = resultArray;

    return {
      sqrtPriceX96: BigInt(sqrtPriceX96 as bigint | string | number),
      tick: Number(tick),
      observationIndex: Number(observationIndex),
      observationCardinality: Number(observationCardinality),
      observationCardinalityNext: Number(observationCardinalityNext),
      feeProtocol: Number(feeProtocol),
      unlocked: Boolean(unlocked),
    };
  } catch (error) {
    console.error(`[ONCHAIN] Failed to read pool slot0 for ${poolAddress}:`, error);
    return null;
  }
}

/**
 * Read pool liquidity
 */
export async function readPoolLiquidity(poolAddress: Address): Promise<bigint | null> {
  try {
    const liquidity = await withTimeout(
      publicClient.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'liquidity',
      }),
      10000,
      'Pool liquidity read timeout'
    );

    return BigInt(liquidity);
  } catch (error) {
    console.error(`[ONCHAIN] Failed to read pool liquidity for ${poolAddress}:`, error);
    return null;
  }
}

/**
 * Get owner of NFT position
 */
export async function readPositionOwner(tokenId: bigint): Promise<Address | null> {
  try {
    const owner = await withTimeout(
      publicClient.readContract({
        address: ENOSYS_ADDRESSES.POSITION_MANAGER,
        abi: [
          {
            name: 'ownerOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'tokenId', type: 'uint256' }],
            outputs: [{ name: '', type: 'address' }],
          },
        ],
        functionName: 'ownerOf',
        args: [tokenId],
      }),
      10000,
      'Owner read timeout'
    );

    return owner as Address;
  } catch (error) {
    console.error(`[ONCHAIN] Failed to read owner for position ${tokenId}:`, error);
    return null;
  }
}

/**
 * Get token balance
 */
export async function readTokenBalance(tokenAddress: Address, account: Address): Promise<bigint | null> {
  try {
    const balance = await withTimeout(
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account],
      }),
      10000,
      'Token balance read timeout'
    );

    return BigInt(balance);
  } catch (error) {
    console.error(`[ONCHAIN] Failed to read token balance for ${tokenAddress}/${account}:`, error);
    return null;
  }
}

/**
 * Get latest block number
 */
export async function readLatestBlockNumber(): Promise<bigint | null> {
  return memoize('latest-block-number', async () => {
    try {
      const blockNumber = await withTimeout(
        publicClient.getBlockNumber(),
        10000,
        'Latest block number read timeout'
      );

      return blockNumber;
    } catch (error) {
      console.error(`[ONCHAIN] Failed to read latest block number:`, error);
      return null;
    }
  }, CACHE_TTL.BLOCK_NUMBER);
}

/**
 * Get block timestamp
 */
export async function readBlockTimestamp(blockNumber: bigint): Promise<number | null> {
  return memoize(`block-timestamp-${blockNumber}`, async () => {
    try {
      const block = await withTimeout(
        publicClient.getBlock({ blockNumber }),
        10000,
        'Block timestamp read timeout'
      );

      return Number(block.timestamp);
    } catch (error) {
      console.error(`[ONCHAIN] Failed to read block timestamp for ${blockNumber}:`, error);
      return null;
    }
  }, CACHE_TTL.TOKEN_METADATA); // Long TTL since block timestamps don't change
}

/**
 * Convert sqrtPriceX96 to human-readable price
 * Formula: price = (sqrtPriceX96 / 2^96)^2 * 10^(decimals0 - decimals1)
 */
export function sqrtPriceX96ToPrice(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number
): number {
  const Q96 = BigInt(2 ** 96);
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  const price = sqrtPrice ** 2;
  const decimalAdjustment = 10 ** (decimals0 - decimals1);
  const adjustedPrice = price * decimalAdjustment;
  
  // Clamp to avoid extreme values
  if (!Number.isFinite(adjustedPrice) || adjustedPrice <= 0) {
    console.warn('[ONCHAIN] Invalid price calculated:', { sqrtPriceX96, adjustedPrice });
    return 0;
  }
  
  return adjustedPrice;
}

/**
 * Get live pool price from slot0
 */
export async function getLivePoolPrice(
  poolAddress: Address,
  decimals0: number,
  decimals1: number
): Promise<number | null> {
  const slot0 = await readPoolSlot0(poolAddress);
  if (!slot0) return null;
  
  return sqrtPriceX96ToPrice(slot0.sqrtPriceX96, decimals0, decimals1);
}

