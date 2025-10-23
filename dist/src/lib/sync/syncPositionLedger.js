"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncPositionLedger = syncPositionLedger;
exports.syncMultiplePositions = syncMultiplePositions;
const viemClient_1 = require("../../lib/viemClient");
const pmFallback_1 = require("../../services/pmFallback");
const flarescanService_1 = require("../../services/flarescanService");
const viem_1 = require("viem");
const UniswapV3Pool_1 = require("../../abis/UniswapV3Pool");
const positionEvents_1 = require("../../lib/data/positionEvents");
const positionTransfers_1 = require("../../lib/data/positionTransfers");
const poolHelpers_1 = require("../../utils/poolHelpers");
const POSITION_MANAGER_ADDRESS = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657';
async function syncPositionLedger(tokenId, options = {}) {
    const { verbose = false } = options;
    try {
        if (verbose) {
            console.log(`[SYNC] Starting ledger sync for position ${tokenId}`);
        }
        // Step 1: Fetch position data to get pool address
        const position = await (0, pmFallback_1.getPositionById)(tokenId);
        if (!position) {
            throw new Error(`Position ${tokenId} not found`);
        }
        if (verbose) {
            console.log(`[SYNC] Found position ${tokenId} in pool ${position.poolAddress}`);
        }
        // Step 2: Fetch and process NFT transfers
        const transfers = await (0, flarescanService_1.getPositionNftTransfers)(POSITION_MANAGER_ADDRESS, tokenId);
        if (verbose) {
            console.log(`[SYNC] Found ${transfers.length} NFT transfers`);
        }
        const positionTransfers = transfers
            .filter(transfer => transfer.txHash) // Filter out transfers without txHash
            .map((transfer, index) => ({
            id: `${transfer.txHash}:${index}`,
            tokenId,
            from: transfer.from,
            to: transfer.to,
            blockNumber: transfer.blockNumber,
            txHash: transfer.txHash,
            logIndex: index, // Use array index as logIndex
            timestamp: transfer.timestamp || Math.floor(Date.now() / 1000), // Use current time as fallback
            metadata: {
                value: '0',
            },
        }));
        // Step 3: Fetch pool events for this position
        const mintTransfer = transfers.find(t => t.from === '0x0000000000000000000000000000000000000000');
        const mintBlock = mintTransfer?.blockNumber || 0;
        if (verbose) {
            console.log(`[SYNC] Position minted at block ${mintBlock}`);
        }
        // Fetch logs from pool contract
        const latestBlock = await viemClient_1.publicClient.getBlockNumber();
        const fromBlock = BigInt(options.fromBlock || mintBlock);
        const toBlock = BigInt(options.toBlock || latestBlock);
        if (verbose) {
            console.log(`[SYNC] Fetching pool events from block ${fromBlock} to ${toBlock}`);
        }
        const positionEvents = [];
        // Fetch events in chunks to avoid RPC limits (Flare RPC max is 30 blocks)
        const chunkSize = 25n;
        for (let currentBlock = fromBlock; currentBlock <= toBlock; currentBlock += chunkSize) {
            const chunkEnd = currentBlock + chunkSize - 1n < toBlock
                ? currentBlock + chunkSize - 1n
                : toBlock;
            try {
                const logs = await viemClient_1.publicClient.getLogs({
                    address: position.poolAddress,
                    fromBlock: currentBlock,
                    toBlock: chunkEnd,
                });
                if (verbose && logs.length > 0) {
                    console.log(`[SYNC] Found ${logs.length} logs in block range ${currentBlock}-${chunkEnd}`);
                }
                // Process each log
                for (const log of logs) {
                    try {
                        const decoded = (0, viem_1.decodeEventLog)({
                            abi: UniswapV3Pool_1.UNISWAP_V3_POOL_ABI,
                            data: log.data,
                            topics: log.topics,
                        });
                        // Only process events related to this position
                        const isRelevant = checkEventRelevance(decoded, position);
                        if (!isRelevant)
                            continue;
                        const eventType = mapEventType(decoded.eventName);
                        if (!eventType) {
                            // TODO: For pool-level events (Swap, Flash), consider separate ingestion
                            continue;
                        }
                        // Get block timestamp
                        const block = await viemClient_1.publicClient.getBlock({ blockNumber: log.blockNumber });
                        const timestamp = Number(block.timestamp);
                        // Extract position metadata for calculations
                        const price0Usd = position.price0Usd || 0;
                        const price1Usd = position.price1Usd || 0;
                        const decimals0 = position.token0.decimals || 18;
                        const decimals1 = position.token1.decimals || 18;
                        // Extract amounts from decoded args
                        const args = decoded.args;
                        // Get amount, amount0, amount1, liquidity safely
                        const amount0BigInt = args?.amount0 || 0n;
                        const amount1BigInt = args?.amount1 || 0n;
                        const liquidityBigInt = args?.liquidity || args?.amount || 0n;
                        const sqrtPriceX96 = args?.sqrtPriceX96;
                        const tick = args?.tick;
                        // Convert to decimal for USD calculations
                        const amount0Decimal = amount0BigInt ? (0, poolHelpers_1.bigIntToDecimal)(amount0BigInt, decimals0) : 0;
                        const amount1Decimal = amount1BigInt ? (0, poolHelpers_1.bigIntToDecimal)(amount1BigInt, decimals1) : 0;
                        // Calculate price1Per0 using tick or fallback
                        let price1Per0 = 0;
                        try {
                            const tickForPrice = tick ?? position.currentTick ?? 0;
                            if (tickForPrice !== 0) {
                                price1Per0 = (0, poolHelpers_1.tickToPrice)(tickForPrice, decimals0, decimals1);
                            }
                            else {
                                // Fallback to price ratio
                                price1Per0 = price0Usd > 0 ? price1Usd / price0Usd : 0;
                            }
                        }
                        catch {
                            // Fallback to price ratio if tickToPrice fails
                            price1Per0 = price0Usd > 0 ? price1Usd / price0Usd : 0;
                        }
                        // Calculate USD value
                        const usdValue = amount0Decimal * price0Usd + amount1Decimal * price1Usd;
                        const event = {
                            id: `${log.transactionHash}:${log.logIndex}`,
                            tokenId,
                            pool: position.poolAddress,
                            blockNumber: Number(log.blockNumber),
                            txHash: log.transactionHash,
                            logIndex: Number(log.logIndex || 0),
                            timestamp,
                            eventType,
                            sender: args?.sender || args?.owner,
                            owner: args?.owner,
                            recipient: args?.recipient,
                            tickLower: position.tickLower,
                            tickUpper: position.tickUpper,
                            tick,
                            liquidityDelta: liquidityBigInt?.toString(),
                            amount0: amount0BigInt?.toString(),
                            amount1: amount1BigInt?.toString(),
                            sqrtPriceX96: sqrtPriceX96?.toString(),
                            price1Per0,
                            usdValue,
                            metadata: {
                                eventName: decoded.eventName,
                                amount0Decimal,
                                amount1Decimal,
                            },
                        };
                        positionEvents.push(event);
                        if (verbose) {
                            console.log(`[SYNC] Processed ${decoded.eventName} event at block ${log.blockNumber}`);
                        }
                    }
                    catch {
                        // Skip events we can't decode
                        if (verbose) {
                            console.warn(`[SYNC] Could not decode log at ${log.transactionHash}:${log.logIndex}`);
                        }
                    }
                }
            }
            catch (chunkError) {
                console.error(`[SYNC] Error fetching chunk ${currentBlock}-${chunkEnd}:`, chunkError);
            }
        }
        // Step 4: Bulk insert into database (optional - gracefully handle failures)
        let dbWriteSuccess = false;
        try {
            if (verbose) {
                console.log(`[SYNC] Inserting ${positionTransfers.length} transfers into database`);
            }
            await (0, positionTransfers_1.bulkUpsertPositionTransfers)(positionTransfers);
            if (verbose) {
                console.log(`[SYNC] Inserting ${positionEvents.length} events into database`);
            }
            await (0, positionEvents_1.bulkUpsertPositionEvents)(positionEvents);
            dbWriteSuccess = true;
            if (verbose) {
                console.log(`[SYNC] Successfully wrote to database for position ${tokenId}`);
            }
        }
        catch (dbError) {
            // Database write failed - log but don't fail the entire sync
            console.warn(`[SYNC] Database write failed for position ${tokenId} (continuing without persistence):`, dbError);
        }
        if (verbose) {
            console.log(`[SYNC] Ledger sync completed for position ${tokenId} (DB write: ${dbWriteSuccess ? 'success' : 'skipped'})`);
        }
        return {
            success: true,
            eventsIngested: positionEvents.length,
            transfersIngested: positionTransfers.length,
            events: positionEvents,
            transfers: positionTransfers,
        };
    }
    catch (error) {
        console.error(`[SYNC] Error syncing position ${tokenId}:`, error);
        return {
            success: false,
            eventsIngested: 0,
            transfersIngested: 0,
            events: [],
            transfers: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
function checkEventRelevance(decoded, position) {
    const args = decoded.args || {};
    // For Mint, Burn, IncreaseLiquidity, DecreaseLiquidity: check tick range
    if (['Mint', 'Burn', 'IncreaseLiquidity', 'DecreaseLiquidity'].includes(decoded.eventName)) {
        if (args.tickLower !== undefined && args.tickUpper !== undefined) {
            return (args.tickLower === position.tickLower &&
                args.tickUpper === position.tickUpper);
        }
    }
    // For Collect events: check tick range AND owner/recipient matches wallet
    if (decoded.eventName === 'Collect') {
        const ticksMatch = args.tickLower === position.tickLower &&
            args.tickUpper === position.tickUpper;
        if (!ticksMatch)
            return false;
        // If we have wallet address, verify owner/recipient
        if (position.walletAddress) {
            const owner = args.owner?.toLowerCase();
            const recipient = args.recipient?.toLowerCase();
            const wallet = position.walletAddress.toLowerCase();
            return owner === wallet || recipient === wallet;
        }
        // No wallet check, just tick range match
        return true;
    }
    return false;
}
function mapEventType(eventName) {
    const mapping = {
        'Mint': 'MINT',
        'Burn': 'BURN',
        'Collect': 'COLLECT',
        'Swap': 'SWAP',
        'IncreaseLiquidity': 'INCREASE',
        'DecreaseLiquidity': 'DECREASE',
    };
    return mapping[eventName] || null;
}
async function syncMultiplePositions(tokenIds, options = {}) {
    const { verbose = false } = options;
    if (verbose) {
        console.log(`[SYNC] Starting batch sync for ${tokenIds.length} positions`);
    }
    const results = [];
    let successful = 0;
    let failed = 0;
    for (const tokenId of tokenIds) {
        const result = await syncPositionLedger(tokenId, { ...options, verbose: false });
        if (result.success) {
            successful++;
        }
        else {
            failed++;
        }
        results.push({
            tokenId,
            ...result,
        });
        if (verbose) {
            console.log(`[SYNC] Progress: ${successful + failed}/${tokenIds.length} ` +
                `(${successful} successful, ${failed} failed)`);
        }
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (verbose) {
        console.log(`[SYNC] Batch sync completed: ${successful} successful, ${failed} failed`);
    }
    return {
        total: tokenIds.length,
        successful,
        failed,
        results,
    };
}
