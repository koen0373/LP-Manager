"use strict";
/**
 * On-chain Readers
 * Pure read-only functions for fetching blockchain state
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTokenMetadata = readTokenMetadata;
exports.readPositionData = readPositionData;
exports.readPoolAddress = readPoolAddress;
exports.readPoolSlot0 = readPoolSlot0;
exports.readPoolLiquidity = readPoolLiquidity;
exports.readPositionOwner = readPositionOwner;
exports.readTokenBalance = readTokenBalance;
exports.readLatestBlockNumber = readLatestBlockNumber;
exports.readBlockTimestamp = readBlockTimestamp;
const client_1 = require("./client");
const abis_1 = require("./abis");
const NonfungiblePositionManager_json_1 = __importDefault(require("../../abis/NonfungiblePositionManager.json"));
const config_1 = require("./config");
const memo_1 = require("../util/memo");
const withTimeout_1 = require("../util/withTimeout");
/**
 * Read token metadata (symbol, name, decimals)
 */
async function readTokenMetadata(tokenAddress) {
    return (0, memo_1.memoize)(`token-metadata-${tokenAddress}`, async () => {
        try {
            const [symbol, name, decimals] = await Promise.all([
                (0, withTimeout_1.withTimeout)(client_1.publicClient.readContract({
                    address: tokenAddress,
                    abi: abis_1.ERC20_ABI,
                    functionName: 'symbol',
                }), 10000, 'Token symbol read timeout').catch(() => 'UNKNOWN'),
                (0, withTimeout_1.withTimeout)(client_1.publicClient.readContract({
                    address: tokenAddress,
                    abi: abis_1.ERC20_ABI,
                    functionName: 'name',
                }), 10000, 'Token name read timeout').catch(() => 'Unknown Token'),
                (0, withTimeout_1.withTimeout)(client_1.publicClient.readContract({
                    address: tokenAddress,
                    abi: abis_1.ERC20_ABI,
                    functionName: 'decimals',
                }), 10000, 'Token decimals read timeout').catch(() => 18),
            ]);
            return {
                symbol: String(symbol),
                name: String(name),
                decimals: Number(decimals),
            };
        }
        catch (error) {
            console.error(`[ONCHAIN] Failed to read token metadata for ${tokenAddress}:`, error);
            return { symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 18 };
        }
    }, config_1.CACHE_TTL.TOKEN_METADATA);
}
/**
 * Read position data from NonfungiblePositionManager
 */
async function readPositionData(tokenId) {
    try {
        const result = await (0, withTimeout_1.withTimeout)(client_1.publicClient.readContract({
            address: config_1.ENOSYS_ADDRESSES.POSITION_MANAGER,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            abi: NonfungiblePositionManager_json_1.default,
            functionName: 'positions',
            args: [tokenId],
        }), 15000, 'Position read timeout');
        // result is a tuple: [nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, ...]
        const resultArray = result;
        const [nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1,] = resultArray;
        return {
            nonce: BigInt(nonce),
            operator: operator,
            token0: token0,
            token1: token1,
            fee: Number(fee),
            tickLower: Number(tickLower),
            tickUpper: Number(tickUpper),
            liquidity: BigInt(liquidity),
            feeGrowthInside0LastX128: BigInt(feeGrowthInside0LastX128),
            feeGrowthInside1LastX128: BigInt(feeGrowthInside1LastX128),
            tokensOwed0: BigInt(tokensOwed0),
            tokensOwed1: BigInt(tokensOwed1),
        };
    }
    catch (error) {
        console.error(`[ONCHAIN] Failed to read position ${tokenId}:`, error);
        return null;
    }
}
/**
 * Get pool address from factory
 */
async function readPoolAddress(token0, token1, fee) {
    return (0, memo_1.memoize)(`pool-address-${token0}-${token1}-${fee}`, async () => {
        try {
            const poolAddress = await (0, withTimeout_1.withTimeout)(client_1.publicClient.readContract({
                address: config_1.ENOSYS_ADDRESSES.FACTORY,
                abi: abis_1.FACTORY_ABI,
                functionName: 'getPool',
                args: [token0, token1, fee],
            }), 10000, 'Pool address read timeout');
            return poolAddress;
        }
        catch (error) {
            console.error(`[ONCHAIN] Failed to read pool address for ${token0}/${token1}/${fee}:`, error);
            return null;
        }
    }, config_1.CACHE_TTL.TOKEN_METADATA); // Long TTL since pool addresses don't change
}
/**
 * Read pool slot0 (current price, tick, etc.)
 */
async function readPoolSlot0(poolAddress) {
    try {
        const result = await (0, withTimeout_1.withTimeout)(client_1.publicClient.readContract({
            address: poolAddress,
            abi: abis_1.POOL_ABI,
            functionName: 'slot0',
        }), 10000, 'Pool slot0 read timeout');
        const resultArray = result;
        const [sqrtPriceX96, tick, observationIndex, observationCardinality, observationCardinalityNext, feeProtocol, unlocked] = resultArray;
        return {
            sqrtPriceX96: BigInt(sqrtPriceX96),
            tick: Number(tick),
            observationIndex: Number(observationIndex),
            observationCardinality: Number(observationCardinality),
            observationCardinalityNext: Number(observationCardinalityNext),
            feeProtocol: Number(feeProtocol),
            unlocked: Boolean(unlocked),
        };
    }
    catch (error) {
        console.error(`[ONCHAIN] Failed to read pool slot0 for ${poolAddress}:`, error);
        return null;
    }
}
/**
 * Read pool liquidity
 */
async function readPoolLiquidity(poolAddress) {
    try {
        const liquidity = await (0, withTimeout_1.withTimeout)(client_1.publicClient.readContract({
            address: poolAddress,
            abi: abis_1.POOL_ABI,
            functionName: 'liquidity',
        }), 10000, 'Pool liquidity read timeout');
        return BigInt(liquidity);
    }
    catch (error) {
        console.error(`[ONCHAIN] Failed to read pool liquidity for ${poolAddress}:`, error);
        return null;
    }
}
/**
 * Get owner of NFT position
 */
async function readPositionOwner(tokenId) {
    try {
        const owner = await (0, withTimeout_1.withTimeout)(client_1.publicClient.readContract({
            address: config_1.ENOSYS_ADDRESSES.POSITION_MANAGER,
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
        }), 10000, 'Owner read timeout');
        return owner;
    }
    catch (error) {
        console.error(`[ONCHAIN] Failed to read owner for position ${tokenId}:`, error);
        return null;
    }
}
/**
 * Get token balance
 */
async function readTokenBalance(tokenAddress, account) {
    try {
        const balance = await (0, withTimeout_1.withTimeout)(client_1.publicClient.readContract({
            address: tokenAddress,
            abi: abis_1.ERC20_ABI,
            functionName: 'balanceOf',
            args: [account],
        }), 10000, 'Token balance read timeout');
        return BigInt(balance);
    }
    catch (error) {
        console.error(`[ONCHAIN] Failed to read token balance for ${tokenAddress}/${account}:`, error);
        return null;
    }
}
/**
 * Get latest block number
 */
async function readLatestBlockNumber() {
    return (0, memo_1.memoize)('latest-block-number', async () => {
        try {
            const blockNumber = await (0, withTimeout_1.withTimeout)(client_1.publicClient.getBlockNumber(), 10000, 'Latest block number read timeout');
            return blockNumber;
        }
        catch (error) {
            console.error(`[ONCHAIN] Failed to read latest block number:`, error);
            return null;
        }
    }, config_1.CACHE_TTL.BLOCK_NUMBER);
}
/**
 * Get block timestamp
 */
async function readBlockTimestamp(blockNumber) {
    return (0, memo_1.memoize)(`block-timestamp-${blockNumber}`, async () => {
        try {
            const block = await (0, withTimeout_1.withTimeout)(client_1.publicClient.getBlock({ blockNumber }), 10000, 'Block timestamp read timeout');
            return Number(block.timestamp);
        }
        catch (error) {
            console.error(`[ONCHAIN] Failed to read block timestamp for ${blockNumber}:`, error);
            return null;
        }
    }, config_1.CACHE_TTL.TOKEN_METADATA); // Long TTL since block timestamps don't change
}
