"use strict";
/**
 * Data Normalization
 * Transform EnrichedPosition to PositionRow (app's DTO)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePosition = normalizePosition;
exports.normalizePositions = normalizePositions;
exports.filterByStatus = filterByStatus;
exports.sortPositions = sortPositions;
/**
 * Convert EnrichedPosition to PositionRow
 */
function normalizePosition(enriched) {
    const { tokenId, poolAddress, token0, token1, fee, currentTick, tickLower, tickUpper, amount0, amount1, tokensOwed0, tokensOwed1, inRange, lowerPrice, upperPrice, tvlUsd, feesUsd, rflrRewards, rflrUsd, owner, } = enriched;
    const normalized = {
        id: tokenId,
        pairLabel: `${token0.symbol}/${token1.symbol}`,
        poolAddress: poolAddress,
        walletAddress: owner,
        token0: {
            address: token0.address,
            symbol: token0.symbol,
            name: token0.name,
            decimals: token0.decimals,
        },
        token1: {
            address: token1.address,
            symbol: token1.symbol,
            name: token1.name,
            decimals: token1.decimals,
        },
        feeTierBps: fee,
        tickLower,
        tickLowerLabel: tickLower.toString(),
        tickUpper,
        tickUpperLabel: tickUpper.toString(),
        currentTick,
        amount0: Number(amount0) / Math.pow(10, token0.decimals),
        amount1: Number(amount1) / Math.pow(10, token1.decimals),
        fee0: Number(tokensOwed0) / Math.pow(10, token0.decimals),
        fee1: Number(tokensOwed1) / Math.pow(10, token1.decimals),
        lowerPrice,
        upperPrice,
        price0Usd: token0.priceUsd,
        price1Usd: token1.priceUsd,
        tvlUsd,
        rewardsUsd: feesUsd,
        rflrAmount: rflrRewards,
        rflrUsd,
        rflrPriceUsd: rflrRewards > 0 ? rflrUsd / rflrRewards : 0,
        inRange,
        isInRange: inRange,
        status: tvlUsd > 1 ? 'Active' : 'Inactive',
        createdAt: enriched.createdAt?.toISOString(),
        lastUpdated: enriched.lastUpdated.toISOString(),
    };
    return normalized;
}
/**
 * Normalize multiple positions
 */
function normalizePositions(enrichedPositions) {
    return enrichedPositions.map(normalizePosition);
}
/**
 * Filter normalized positions by status
 */
function filterByStatus(positions, status) {
    return positions.filter((pos) => pos.status === status);
}
/**
 * Sort normalized positions
 */
function sortPositions(positions, sortBy = 'tvl', order = 'desc') {
    const sorted = [...positions];
    sorted.sort((a, b) => {
        let aValue;
        let bValue;
        switch (sortBy) {
            case 'tvl':
                aValue = a.tvlUsd;
                bValue = b.tvlUsd;
                break;
            case 'rewards':
                aValue = a.rewardsUsd + a.rflrUsd;
                bValue = b.rewardsUsd + b.rflrUsd;
                break;
            case 'fees':
                aValue = a.rewardsUsd;
                bValue = b.rewardsUsd;
                break;
            case 'id':
                aValue = parseInt(a.id, 10);
                bValue = parseInt(b.id, 10);
                break;
            default:
                aValue = a.tvlUsd;
                bValue = b.tvlUsd;
        }
        return order === 'desc' ? bValue - aValue : aValue - bValue;
    });
    return sorted;
}
