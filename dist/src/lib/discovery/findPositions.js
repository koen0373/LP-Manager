"use strict";
/**
 * Position Discovery
 * Find all NFT positions owned by a wallet
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
exports.findPositionsByWallet = findPositionsByWallet;
exports.isPositionOwnedBy = isPositionOwnedBy;
exports.getPositionOwner = getPositionOwner;
const client_1 = require("../onchain/client");
const config_1 = require("../onchain/config");
const memo_1 = require("../util/memo");
const withTimeout_1 = require("../util/withTimeout");
/**
 * Get token IDs owned by a wallet using balanceOf + tokenOfOwnerByIndex
 */
async function findPositionsByWallet(walletAddress, options = {}) {
    const cacheKey = `wallet-positions-${walletAddress}`;
    if (options.refresh) {
        // Clear cache if refresh requested
        const { clearCache } = await Promise.resolve().then(() => __importStar(require('../util/memo')));
        clearCache(cacheKey);
    }
    return (0, memo_1.memoize)(cacheKey, async () => {
        try {
            console.log(`[DISCOVERY] Finding positions for wallet: ${walletAddress}`);
            // Step 1: Get balance of NFTs owned by this wallet
            const balance = await (0, withTimeout_1.withTimeout)(client_1.publicClient.readContract({
                address: config_1.ENOSYS_ADDRESSES.POSITION_MANAGER,
                abi: [
                    {
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'owner', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }],
                    },
                ],
                functionName: 'balanceOf',
                args: [walletAddress],
            }), 15000, 'balanceOf read timeout');
            const balanceNum = Number(balance);
            console.log(`[DISCOVERY] Wallet ${walletAddress} has ${balanceNum} positions`);
            if (balanceNum === 0) {
                return [];
            }
            // Step 2: Get each token ID by index
            const tokenIds = [];
            const batchSize = 10; // Process 10 at a time to avoid overwhelming RPC
            for (let i = 0; i < balanceNum; i += batchSize) {
                const batch = Array.from({ length: Math.min(batchSize, balanceNum - i) }, (_, idx) => i + idx);
                const batchResults = await Promise.allSettled(batch.map(async (index) => {
                    try {
                        const tokenId = await (0, withTimeout_1.withTimeout)(client_1.publicClient.readContract({
                            address: config_1.ENOSYS_ADDRESSES.POSITION_MANAGER,
                            abi: [
                                {
                                    name: 'tokenOfOwnerByIndex',
                                    type: 'function',
                                    stateMutability: 'view',
                                    inputs: [
                                        { name: 'owner', type: 'address' },
                                        { name: 'index', type: 'uint256' },
                                    ],
                                    outputs: [{ name: '', type: 'uint256' }],
                                },
                            ],
                            functionName: 'tokenOfOwnerByIndex',
                            args: [walletAddress, BigInt(index)],
                        }), 10000, `tokenOfOwnerByIndex read timeout for index ${index}`);
                        return BigInt(tokenId);
                    }
                    catch (error) {
                        console.warn(`[DISCOVERY] Failed to get token ID at index ${index}:`, error);
                        return null;
                    }
                }));
                // Collect successful results
                for (const result of batchResults) {
                    if (result.status === 'fulfilled' && result.value !== null) {
                        tokenIds.push(result.value);
                    }
                }
            }
            console.log(`[DISCOVERY] Found ${tokenIds.length} token IDs:`, tokenIds.map(id => id.toString()));
            return tokenIds;
        }
        catch (error) {
            console.error(`[DISCOVERY] Failed to find positions for wallet ${walletAddress}:`, error);
            return [];
        }
    }, 120000); // Cache for 2 minutes
}
/**
 * Check if a wallet owns a specific position
 */
async function isPositionOwnedBy(tokenId, walletAddress) {
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
        }), 10000, 'ownerOf read timeout');
        return owner.toLowerCase() === walletAddress.toLowerCase();
    }
    catch (error) {
        console.warn(`[DISCOVERY] Failed to check ownership of position ${tokenId}:`, error);
        return false;
    }
}
/**
 * Get owner of a position
 */
async function getPositionOwner(tokenId) {
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
        }), 10000, 'ownerOf read timeout');
        return owner;
    }
    catch (error) {
        console.warn(`[DISCOVERY] Failed to get owner of position ${tokenId}:`, error);
        return null;
    }
}
