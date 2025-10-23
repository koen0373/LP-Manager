"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPositionById = getPositionById;
exports.getLpPositionsOnChain = getLpPositionsOnChain;
const clientFactory_1 = require("../lib/adapters/clientFactory");
const NonfungiblePositionManager_json_1 = __importDefault(require("../abis/NonfungiblePositionManager.json"));
const rflrRewards_1 = require("./rflrRewards");
const tokenPrices_1 = require("./tokenPrices");
const concurrency_1 = require("../lib/util/concurrency");
const memo_1 = require("../lib/util/memo");
const withTimeout_1 = require("../lib/util/withTimeout");
const poolHelpers_1 = require("../utils/poolHelpers");
const readers_1 = require("../lib/onchain/readers");
const pm = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657';
const publicClient = (0, clientFactory_1.createClientWithFallback)([
    'https://flare.flr.finance/ext/bc/C/rpc',
    'https://flare.public-rpc.com',
    'https://rpc-enosys.flare.network'
]);
// Token metadata cache
const tokenCache = new Map();
// Get token metadata using Viem
async function getTokenMetadata(address) {
    const normalized = (0, poolHelpers_1.normalizeAddress)(address);
    if (tokenCache.has(normalized)) {
        return tokenCache.get(normalized);
    }
    try {
        const [symbol, name, decimals] = await Promise.all([
            publicClient.readContract({
                address: normalized,
                abi: [
                    {
                        name: 'symbol',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [],
                        outputs: [{ type: 'string' }],
                    },
                ],
                functionName: 'symbol',
            }).catch(() => 'UNKNOWN'),
            publicClient.readContract({
                address,
                abi: [
                    {
                        name: 'name',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [],
                        outputs: [{ type: 'string' }],
                    },
                ],
                functionName: 'name',
            }).catch(() => 'Unknown Token'),
            publicClient.readContract({
                address: normalized,
                abi: [
                    {
                        name: 'decimals',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [],
                        outputs: [{ type: 'uint8' }],
                    },
                ],
                functionName: 'decimals',
            }).catch(() => 18),
        ]);
        const metadata = { symbol, name, decimals };
        tokenCache.set(normalized, metadata);
        return metadata;
    }
    catch (error) {
        console.error(`Failed to get token metadata for ${address}:`, error);
        return { symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 18 };
    }
}
async function parsePositionData(tokenId, positionData, walletAddress) {
    try {
        console.log(`[DEBUG] Parsing Viem position data for tokenId: ${tokenId.toString()}`);
        const values = Array.isArray(positionData) ? positionData : Object.values(positionData);
        const tuple = values;
        const [, , token0Raw, token1Raw, feeRaw, tickLowerRaw, tickUpperRaw, liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1,] = tuple;
        // Normalize token addresses & ticks
        const token0 = (0, poolHelpers_1.normalizeAddress)(token0Raw);
        const token1 = (0, poolHelpers_1.normalizeAddress)(token1Raw);
        const fee = Number(feeRaw);
        const tickLower = (0, poolHelpers_1.toSignedInt24)(tickLowerRaw);
        const tickUpper = (0, poolHelpers_1.toSignedInt24)(tickUpperRaw);
        console.log(`[DEBUG] Viem position tuple:`);
        console.log(`[DEBUG] Token0: ${token0}, Token1: ${token1}`);
        console.log(`[DEBUG] Fee: ${fee}, TickLower: ${tickLower}, TickUpper: ${tickUpper}`);
        console.log(`[DEBUG] Liquidity: ${liquidity.toString()}`);
        // Get token metadata
        const [token0Meta, token1Meta] = await Promise.all([
            getTokenMetadata(token0),
            getTokenMetadata(token1),
        ]);
        console.log('[METADATA][viem]', {
            token0: token0Meta,
            token1: token1Meta,
        });
        const { lowerPrice, upperPrice } = (0, poolHelpers_1.computePriceRange)(tickLower, tickUpper, token0Meta.decimals, token1Meta.decimals);
        // Get factory address and pool address
        const factory = await (0, poolHelpers_1.getFactoryAddress)(pm);
        const poolAddress = await (0, poolHelpers_1.getPoolAddress)(factory, token0, token1, fee);
        // Get pool state
        const { sqrtPriceX96, tick: currentTick } = await (0, poolHelpers_1.getPoolState)(poolAddress);
        // Calculate amounts using proper Uniswap V3 math
        console.log(`[PMFALLBACK] Calculating amounts for tokenId ${tokenId}, liquidity: ${liquidity.toString()}`);
        const { amount0Wei, amount1Wei } = (0, poolHelpers_1.calcAmountsForPosition)(liquidity, sqrtPriceX96, tickLower, tickUpper, token0Meta.decimals, token1Meta.decimals);
        console.log(`[PMFALLBACK] Calculated amounts: amount0Wei=${amount0Wei.toString()}, amount1Wei=${amount1Wei.toString()}`);
        // Check if in range
        const inRange = (0, poolHelpers_1.isInRange)(currentTick, tickLower, tickUpper);
        console.log(`[PMFALLBACK] Position in range: ${inRange} (currentTick: ${currentTick}, range: ${tickLower}-${tickUpper})`);
        const { fee0Wei, fee1Wei } = await (0, poolHelpers_1.calculateAccruedFees)({
            poolAddress,
            liquidity,
            tickLower,
            tickUpper,
            currentTick,
            feeGrowthInside0LastX128,
            feeGrowthInside1LastX128,
            tokensOwed0,
            tokensOwed1,
        });
        // Calculate TVL and rewards
        console.log(`[PMFALLBACK] Calculating TVL and rewards for ${token0Meta.symbol}/${token1Meta.symbol}`);
        const { amount0, amount1, fee0, fee1, price0Usd, price1Usd, tvlUsd, rewardsUsd, } = await (0, poolHelpers_1.calculatePositionValue)({
            token0Symbol: token0Meta.symbol,
            token1Symbol: token1Meta.symbol,
            token0Decimals: token0Meta.decimals,
            token1Decimals: token1Meta.decimals,
            amount0Wei,
            amount1Wei,
            fee0Wei,
            fee1Wei,
            sqrtPriceX96,
        });
        console.log(`[PMFALLBACK] Final TVL: $${tvlUsd}, Rewards: $${rewardsUsd}`);
        console.log('[PMFALLBACK][VALUE]', {
            amount0,
            amount1,
            fee0,
            fee1,
            price0Usd,
            price1Usd,
        });
        const [rflrAmountRaw, rflrPriceUsd, poolLiquidity] = await Promise.all([
            (0, rflrRewards_1.getRflrRewardForPosition)(tokenId.toString()),
            (0, tokenPrices_1.getTokenPrice)('RFLR'),
            (0, readers_1.readPoolLiquidity)(poolAddress),
        ]);
        const rflrAmount = rflrAmountRaw ?? 0;
        const rflrUsd = rflrAmount * rflrPriceUsd;
        // Calculate pool share percentage
        let poolSharePct;
        if (poolLiquidity && poolLiquidity > 0n) {
            poolSharePct = (Number(liquidity) / Number(poolLiquidity)) * 100;
        }
        // Unclaimed fees are separate from RFLR rewards
        // For inactive pools, fees should be 0 as they don't generate swap fees
        const unclaimedFeesUsd = inRange ? rewardsUsd : 0;
        // Create position row
        return {
            id: tokenId.toString(),
            pairLabel: `${token0Meta.symbol} - ${token1Meta.symbol}`,
            feeTierBps: fee,
            tickLowerLabel: (0, poolHelpers_1.formatPrice)(lowerPrice),
            tickUpperLabel: (0, poolHelpers_1.formatPrice)(upperPrice),
            tvlUsd,
            rewardsUsd: unclaimedFeesUsd,
            rflrAmount,
            rflrUsd,
            rflrPriceUsd,
            // APS removed for Phase 3
            inRange,
            status: 'Active',
            token0: {
                symbol: token0Meta.symbol,
                address: token0,
                name: token0Meta.name,
                decimals: token0Meta.decimals
            },
            token1: {
                symbol: token1Meta.symbol,
                address: token1,
                name: token1Meta.name,
                decimals: token1Meta.decimals
            },
            // New fields
            amount0,
            amount1,
            lowerPrice,
            upperPrice,
            tickLower,
            tickUpper,
            isInRange: inRange,
            poolAddress,
            price0Usd,
            price1Usd,
            fee0,
            fee1,
            walletAddress,
            currentTick,
            liquidity,
            poolLiquidity: poolLiquidity || undefined,
            poolSharePct,
        };
    }
    catch (error) {
        console.error('Failed to parse position data:', error);
        return null;
    }
}
// Get a specific position by token ID
async function getPositionById(tokenId) {
    return (0, memo_1.memoize)(`position-${tokenId}`, async () => {
        try {
            console.log(`[PMFALLBACK] Fetching position by ID: ${tokenId}`);
            const tokenIdBigInt = BigInt(tokenId);
            // Get position data directly
            const positionData = await (0, withTimeout_1.withTimeout)(publicClient.readContract({
                address: pm,
                abi: NonfungiblePositionManager_json_1.default,
                functionName: 'positions',
                args: [tokenIdBigInt],
            }), 15000, `Position fetch for ${tokenId} timed out`);
            const parsed = await parsePositionData(tokenIdBigInt, positionData);
            return parsed;
        }
        catch (error) {
            console.error(`Failed to fetch position ${tokenId}:`, error);
            return null;
        }
    }, 5 * 60 * 1000); // 5 minute cache for individual positions
}
async function getLpPositionsOnChain(owner) {
    return (0, memo_1.memoize)(`viem-positions-${owner}`, async () => {
        try {
            console.log(`Fetching positions for wallet using Viem: ${owner}`);
            // Get balance of NFTs (number of positions)
            const bal = await (0, withTimeout_1.withTimeout)(publicClient.readContract({
                address: pm,
                abi: NonfungiblePositionManager_json_1.default,
                functionName: 'balanceOf',
                args: [owner],
            }), 15000, `Balance check for ${owner} timed out`);
            const count = Number(bal);
            console.log(`Found ${count} positions using Viem`);
            if (count === 0) {
                return [];
            }
            const indices = Array.from({ length: count }, (_, i) => i);
            const tokenIdResults = await (0, concurrency_1.mapWithConcurrency)(indices, 20, async (i) => {
                const tokenId = (await publicClient.readContract({
                    address: pm,
                    abi: NonfungiblePositionManager_json_1.default,
                    functionName: 'tokenOfOwnerByIndex',
                    args: [owner, BigInt(i)],
                }));
                return tokenId;
            });
            const tokenIds = tokenIdResults
                .sort((a, b) => a.index - b.index)
                .map((entry) => entry.value);
            const positionResults = await (0, concurrency_1.mapWithConcurrency)(tokenIds, 12, async (tokenId) => {
                const positionData = (await publicClient.readContract({
                    address: pm,
                    abi: NonfungiblePositionManager_json_1.default,
                    functionName: 'positions',
                    args: [tokenId],
                }));
                return parsePositionData(tokenId, positionData, owner);
            });
            return positionResults
                .sort((a, b) => a.index - b.index)
                .map((entry) => entry.value)
                .filter((position) => position !== null);
        }
        catch (error) {
            console.error('Failed to fetch wallet positions using Viem:', error);
            return [];
        }
    }, 30 * 1000); // 30 second cache for wallet positions
}
