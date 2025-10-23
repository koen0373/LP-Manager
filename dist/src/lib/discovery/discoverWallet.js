"use strict";
/**
 * Wallet Discovery Orchestrator
 * Main entry point for discovering all positions for a wallet
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverWalletPositions = discoverWalletPositions;
exports.groupPositionsByStatus = groupPositionsByStatus;
exports.sortPositionsByTvl = sortPositionsByTvl;
exports.sortPositionsByRewards = sortPositionsByRewards;
const findPositions_1 = require("./findPositions");
const enrichPosition_1 = require("./enrichPosition");
/**
 * Discover all positions for a wallet with full enrichment
 */
async function discoverWalletPositions(walletAddress, options = {}) {
    const startTime = Date.now();
    console.log(`[DISCOVERY] Starting wallet discovery for ${walletAddress}`);
    try {
        // Step 1: Find all position token IDs owned by this wallet
        const tokenIds = await (0, findPositions_1.findPositionsByWallet)(walletAddress, {
            refresh: options.refresh,
        });
        if (tokenIds.length === 0) {
            console.log(`[DISCOVERY] No positions found for wallet ${walletAddress}`);
            return {
                wallet: walletAddress,
                positions: [],
                totalCount: 0,
                activeCount: 0,
                inactiveCount: 0,
                totalTvlUsd: 0,
                totalFeesUsd: 0,
                totalRewardsUsd: 0,
                fetchedAt: new Date(),
            };
        }
        // Step 2: Enrich all positions with on-chain + external data
        const enrichedPositions = await (0, enrichPosition_1.enrichPositions)(tokenIds, walletAddress);
        // Step 3: Filter positions based on options
        let filteredPositions = enrichedPositions;
        if (options.minTvlUsd !== undefined) {
            filteredPositions = filteredPositions.filter((pos) => pos.tvlUsd >= (options.minTvlUsd || 0));
        }
        if (!options.includeInactive) {
            // Only include positions with TVL > threshold (e.g., $1)
            filteredPositions = filteredPositions.filter((pos) => pos.tvlUsd > 1);
        }
        // Step 4: Calculate aggregates
        const activePositions = enrichedPositions.filter((pos) => pos.tvlUsd > 1);
        const inactivePositions = enrichedPositions.filter((pos) => pos.tvlUsd <= 1);
        const totalTvlUsd = enrichedPositions.reduce((sum, pos) => sum + pos.tvlUsd, 0);
        const totalFeesUsd = enrichedPositions.reduce((sum, pos) => sum + pos.feesUsd, 0);
        const totalRewardsUsd = enrichedPositions.reduce((sum, pos) => sum + pos.rflrUsd, 0);
        const duration = Date.now() - startTime;
        console.log(`[DISCOVERY] Completed wallet discovery for ${walletAddress} in ${duration}ms: ${filteredPositions.length} positions (${activePositions.length} active, ${inactivePositions.length} inactive)`);
        return {
            wallet: walletAddress,
            positions: filteredPositions,
            totalCount: enrichedPositions.length,
            activeCount: activePositions.length,
            inactiveCount: inactivePositions.length,
            totalTvlUsd,
            totalFeesUsd,
            totalRewardsUsd,
            fetchedAt: new Date(),
        };
    }
    catch (error) {
        console.error(`[DISCOVERY] Failed to discover wallet positions:`, error);
        throw error;
    }
}
/**
 * Helper to group positions by status
 */
function groupPositionsByStatus(positions) {
    const active = [];
    const inactive = [];
    for (const position of positions) {
        if (position.tvlUsd > 1) {
            active.push(position);
        }
        else {
            inactive.push(position);
        }
    }
    return { active, inactive };
}
/**
 * Helper to sort positions by TVL (descending)
 */
function sortPositionsByTvl(positions) {
    return [...positions].sort((a, b) => b.tvlUsd - a.tvlUsd);
}
/**
 * Helper to sort positions by rewards (descending)
 */
function sortPositionsByRewards(positions) {
    return [...positions].sort((a, b) => b.rflrUsd - a.rflrUsd);
}
