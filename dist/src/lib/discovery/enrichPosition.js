"use strict";
/**
 * Position Enrichment
 * Combine on-chain data, Flarescan data, and external pricing into enriched positions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichPosition = enrichPosition;
exports.enrichPositions = enrichPositions;
const readers_1 = require("../onchain/readers");
const findPositions_1 = require("./findPositions");
const getCreationDate_1 = require("./getCreationDate");
const poolHelpers_1 = require("../../utils/poolHelpers");
const tokenPrices_1 = require("../../services/tokenPrices");
const rflrRewards_1 = require("../../services/rflrRewards");
/**
 * Enrich a single position with all available data
 */
async function enrichPosition(tokenId, walletAddress) {
    try {
        console.log(`[ENRICHMENT] Enriching position ${tokenId}`);
        // Step 1: Get raw position data from PositionManager
        const positionData = await (0, readers_1.readPositionData)(tokenId);
        if (!positionData) {
            console.warn(`[ENRICHMENT] No position data found for ${tokenId}`);
            return null;
        }
        // Step 2: Get owner if not provided
        const owner = walletAddress || (await (0, findPositions_1.getPositionOwner)(tokenId));
        if (!owner) {
            console.warn(`[ENRICHMENT] No owner found for position ${tokenId}`);
            return null;
        }
        // Step 3: Get token metadata (parallel)
        const [token0Meta, token1Meta] = await Promise.all([
            (0, readers_1.readTokenMetadata)(positionData.token0),
            (0, readers_1.readTokenMetadata)(positionData.token1),
        ]);
        // Step 4: Get pool address
        const poolAddress = await (0, readers_1.readPoolAddress)(positionData.token0, positionData.token1, positionData.fee);
        if (!poolAddress) {
            console.warn(`[ENRICHMENT] No pool found for position ${tokenId}`);
            return null;
        }
        // Step 5: Get pool state (current tick, price, liquidity)
        const slot0 = await (0, readers_1.readPoolSlot0)(poolAddress);
        if (!slot0) {
            console.warn(`[ENRICHMENT] No slot0 data for pool ${poolAddress}`);
            return null;
        }
        // Step 6: Calculate prices
        const lowerPrice = (0, poolHelpers_1.tickToPrice)(positionData.tickLower, token0Meta.decimals, token1Meta.decimals);
        const upperPrice = (0, poolHelpers_1.tickToPrice)(positionData.tickUpper, token0Meta.decimals, token1Meta.decimals);
        const currentPrice = (0, poolHelpers_1.tickToPrice)(slot0.tick, token0Meta.decimals, token1Meta.decimals);
        // Step 7: Check if in range
        const inRange = slot0.tick >= positionData.tickLower && slot0.tick <= positionData.tickUpper;
        // Step 8: Get token prices (parallel fetch for performance)
        const [token0Price, token1Price, rflrPriceResult] = await Promise.allSettled([
            (0, tokenPrices_1.getTokenPriceByAddress)(positionData.token0),
            (0, tokenPrices_1.getTokenPriceByAddress)(positionData.token1),
            (0, tokenPrices_1.getTokenPriceByAddress)('0x0000000000000000000000000000000000000000'), // RFLR placeholder
        ]);
        const token0PriceUsd = token0Price.status === 'fulfilled' ? token0Price.value : 0;
        const token1PriceUsd = token1Price.status === 'fulfilled' ? token1Price.value : 0;
        const rflrPriceUsd = rflrPriceResult.status === 'fulfilled' ? rflrPriceResult.value : 0;
        // Step 9: Calculate amounts from liquidity using Uniswap V3 math
        const { calcAmountsForPosition } = await Promise.resolve().then(() => __importStar(require('../../utils/poolHelpers')));
        const { amount0Wei, amount1Wei } = calcAmountsForPosition(positionData.liquidity, slot0.sqrtPriceX96, positionData.tickLower, positionData.tickUpper, token0Meta.decimals, token1Meta.decimals);
        const amount0 = amount0Wei;
        const amount1 = amount1Wei;
        // Step 10: Calculate USD values
        const amount0Decimal = Number(amount0Wei) / Math.pow(10, token0Meta.decimals);
        const amount1Decimal = Number(amount1Wei) / Math.pow(10, token1Meta.decimals);
        const tokensOwed0Decimal = Number(positionData.tokensOwed0) / Math.pow(10, token0Meta.decimals);
        const tokensOwed1Decimal = Number(positionData.tokensOwed1) / Math.pow(10, token1Meta.decimals);
        const tvlUsd = amount0Decimal * token0PriceUsd + amount1Decimal * token1PriceUsd;
        const feesUsd = tokensOwed0Decimal * token0PriceUsd + tokensOwed1Decimal * token1PriceUsd;
        // Step 11: Get RFLR rewards
        let rflrRewards = 0;
        let rflrUsd = 0;
        try {
            const rflrResult = await (0, rflrRewards_1.getRflrRewardForPosition)(tokenId.toString());
            rflrRewards = rflrResult || 0;
            rflrUsd = rflrRewards * rflrPriceUsd;
        }
        catch (error) {
            console.warn(`[ENRICHMENT] Failed to get RFLR rewards for position ${tokenId}:`, error);
        }
        // Step 12: Get creation date (non-blocking)
        let createdAt;
        try {
            const creationDate = await (0, getCreationDate_1.getPositionCreationDate)(tokenId);
            if (creationDate) {
                createdAt = creationDate;
            }
        }
        catch (error) {
            console.warn(`[ENRICHMENT] Failed to get creation date for position ${tokenId}:`, error);
        }
        const enriched = {
            tokenId: tokenId.toString(),
            owner,
            poolAddress,
            token0: {
                address: positionData.token0,
                symbol: token0Meta.symbol,
                name: token0Meta.name,
                decimals: token0Meta.decimals,
                priceUsd: token0PriceUsd,
            },
            token1: {
                address: positionData.token1,
                symbol: token1Meta.symbol,
                name: token1Meta.name,
                decimals: token1Meta.decimals,
                priceUsd: token1PriceUsd,
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
            createdAt,
            lastUpdated: new Date(),
        };
        console.log(`[ENRICHMENT] Successfully enriched position ${tokenId}`);
        return enriched;
    }
    catch (error) {
        console.error(`[ENRICHMENT] Failed to enrich position ${tokenId}:`, error);
        return null;
    }
}
/**
 * Enrich multiple positions in parallel (with concurrency limit)
 */
async function enrichPositions(tokenIds, walletAddress, concurrency = 5) {
    console.log(`[ENRICHMENT] Enriching ${tokenIds.length} positions with concurrency ${concurrency}`);
    const results = [];
    // Process in batches to respect concurrency limit
    for (let i = 0; i < tokenIds.length; i += concurrency) {
        const batch = tokenIds.slice(i, i + concurrency);
        const batchResults = await Promise.allSettled(batch.map((tokenId) => enrichPosition(tokenId, walletAddress)));
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
