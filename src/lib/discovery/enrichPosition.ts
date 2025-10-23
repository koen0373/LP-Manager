/**
 * Position Enrichment
 * Combine on-chain data, Flarescan data, and external pricing into enriched positions
 */

import { type Address } from 'viem';
import { readPositionData, readTokenMetadata, readPoolAddress, readPoolSlot0 } from '../onchain/readers';
import { getPositionOwner } from './findPositions';
import { tickToPrice } from '../../utils/poolHelpers';
import type { EnrichedPosition } from './types';

/**
 * Enrich a single position with all available data
 */
export async function enrichPosition(
  tokenId: bigint,
  walletAddress?: Address
): Promise<EnrichedPosition | null> {
  try {
    console.log(`[ENRICHMENT] Enriching position ${tokenId}`);

    // Step 1: Get raw position data from PositionManager
    const positionData = await readPositionData(tokenId);
    if (!positionData) {
      console.warn(`[ENRICHMENT] No position data found for ${tokenId}`);
      return null;
    }

    // Step 2: Get owner if not provided
    const owner = walletAddress || (await getPositionOwner(tokenId));
    if (!owner) {
      console.warn(`[ENRICHMENT] No owner found for position ${tokenId}`);
      return null;
    }

    // Step 3: Get token metadata (parallel)
    const [token0Meta, token1Meta] = await Promise.all([
      readTokenMetadata(positionData.token0),
      readTokenMetadata(positionData.token1),
    ]);

    // Step 4: Get pool address
    const poolAddress = await readPoolAddress(
      positionData.token0,
      positionData.token1,
      positionData.fee
    );

    if (!poolAddress) {
      console.warn(`[ENRICHMENT] No pool found for position ${tokenId}`);
      return null;
    }

    // Step 5: Get pool state (current tick, price, liquidity)
    const slot0 = await readPoolSlot0(poolAddress);
    if (!slot0) {
      console.warn(`[ENRICHMENT] No slot0 data for pool ${poolAddress}`);
      return null;
    }

    // Step 6: Calculate prices
    const lowerPrice = tickToPrice(
      positionData.tickLower,
      token0Meta.decimals,
      token1Meta.decimals
    );
    const upperPrice = tickToPrice(
      positionData.tickUpper,
      token0Meta.decimals,
      token1Meta.decimals
    );
    const currentPrice = tickToPrice(
      slot0.tick,
      token0Meta.decimals,
      token1Meta.decimals
    );

    // Step 7: Check if in range
    const inRange = slot0.tick >= positionData.tickLower && slot0.tick <= positionData.tickUpper;

    // Step 8: Calculate amounts (simplified - will be improved in Phase 3)
    // For now, use liquidity + price to approximate
    const amount0 = positionData.liquidity; // Placeholder
    const amount1 = positionData.liquidity; // Placeholder

    // Step 9: Get token prices (placeholder - will integrate with tokenPrices service)
    const token0Price = 0; // TODO: Integrate getTokenPrice
    const token1Price = 0; // TODO: Integrate getTokenPrice

    // Step 10: Calculate USD values
    const tvlUsd = 0; // TODO: Calculate from amounts * prices
    const feesUsd = 0; // TODO: Calculate from tokensOwed * prices

    // Step 11: Get RFLR rewards (placeholder - will integrate with rflrRewards service)
    const rflrRewards = 0; // TODO: Integrate getRflrRewardForPosition
    const rflrUsd = 0; // TODO: Calculate from rflrRewards * price

    const enriched: EnrichedPosition = {
      tokenId: tokenId.toString(),
      owner,
      poolAddress,
      
      token0: {
        address: positionData.token0,
        symbol: token0Meta.symbol,
        name: token0Meta.name,
        decimals: token0Meta.decimals,
        priceUsd: token0Price,
      },
      token1: {
        address: positionData.token1,
        symbol: token1Meta.symbol,
        name: token1Meta.name,
        decimals: token1Meta.decimals,
        priceUsd: token1Price,
      },
      
      fee: positionData.fee,
      currentTick: slot0.tick,
      sqrtPriceX96: slot0.sqrtPriceX96,
      
      tickLower: positionData.tickLower,
      tickUpper: positionData.tickUpper,
      liquidity: positionData.liquidity,
      
      amount0,
      amount1,
      
      tokensOwed0: positionData.tokensOwed0,
      tokensOwed1: positionData.tokensOwed1,
      
      inRange,
      lowerPrice,
      upperPrice,
      currentPrice,
      
      tvlUsd,
      feesUsd,
      
      rflrRewards,
      rflrUsd,
      
      lastUpdated: new Date(),
    };

    console.log(`[ENRICHMENT] Successfully enriched position ${tokenId}`);
    return enriched;
  } catch (error) {
    console.error(`[ENRICHMENT] Failed to enrich position ${tokenId}:`, error);
    return null;
  }
}

/**
 * Enrich multiple positions in parallel (with concurrency limit)
 */
export async function enrichPositions(
  tokenIds: bigint[],
  walletAddress?: Address,
  concurrency = 5
): Promise<EnrichedPosition[]> {
  console.log(`[ENRICHMENT] Enriching ${tokenIds.length} positions with concurrency ${concurrency}`);
  
  const results: EnrichedPosition[] = [];
  
  // Process in batches to respect concurrency limit
  for (let i = 0; i < tokenIds.length; i += concurrency) {
    const batch = tokenIds.slice(i, i + concurrency);
    
    const batchResults = await Promise.allSettled(
      batch.map((tokenId) => enrichPosition(tokenId, walletAddress))
    );
    
    // Collect successful enrichments
    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value !== null) {
        results.push(result.value);
      }
    }
  }
  
  console.log(`[ENRICHMENT] Successfully enriched ${results.length}/${tokenIds.length} positions`);
  return results;
}

