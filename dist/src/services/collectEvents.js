"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollectEventsForToken = getCollectEventsForToken;
exports.clearCollectEventsCache = clearCollectEventsCache;
// src/services/collectEvents.ts
const memo_1 = require("../lib/util/memo");
const COLLECT_TOPIC = '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610ed3889a5cb8';
const POSITION_MANAGER_ADDRESS = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657';
async function getCollectEventsForToken(tokenId, poolAddress) {
    return (0, memo_1.memoize)(`collect-events-${tokenId}`, async () => {
        console.log(`[COLLECT] Fetching collect events for token ${tokenId}`);
        const tokenIdHex = `0x${BigInt(tokenId).toString(16).padStart(64, '0')}`;
        const events = [];
        // Start from a reasonable block number (recent blocks)
        const latestBlock = await getLatestBlockNumber();
        const startBlock = Math.max(latestBlock - 50000, 0); // Last ~50k blocks
        console.log(`[COLLECT] Searching from block ${startBlock} to ${latestBlock}`);
        // Search both Position Manager and Pool contracts
        const contractsToSearch = [
            POSITION_MANAGER_ADDRESS,
            ...(poolAddress ? [poolAddress] : [])
        ];
        for (const contractAddress of contractsToSearch) {
            console.log(`[COLLECT] Searching contract ${contractAddress}`);
            // Chunk the search in blocks of 25 (RPC limit is 30)
            const chunkSize = 2000;
            for (let fromBlock = startBlock; fromBlock < latestBlock; fromBlock += chunkSize) {
                const toBlock = Math.min(fromBlock + chunkSize - 1, latestBlock);
                try {
                    console.log(`[COLLECT] Searching blocks ${fromBlock} to ${toBlock} in ${contractAddress}`);
                    const chunkEvents = await fetchCollectEventsChunk(fromBlock, toBlock, tokenIdHex, contractAddress);
                    events.push(...chunkEvents);
                    if (chunkEvents.length > 0) {
                        console.log(`[COLLECT] Found ${chunkEvents.length} events in chunk ${fromBlock}-${toBlock} for ${contractAddress}`);
                    }
                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                catch (error) {
                    console.warn(`[COLLECT] Error fetching chunk ${fromBlock}-${toBlock} for ${contractAddress}:`, error);
                }
            }
        }
        console.log(`[COLLECT] Total collect events found for token ${tokenId}: ${events.length}`);
        return events.sort((a, b) => b.blockNumber - a.blockNumber); // Most recent first
    }, 5 * 60 * 1000); // 5 minute cache
}
async function fetchCollectEventsChunk(fromBlock, toBlock, tokenIdHex, contractAddress) {
    try {
        const params = new URLSearchParams({
            module: 'logs',
            action: 'getLogs',
            address: contractAddress,
            fromBlock: fromBlock.toString(),
            toBlock: toBlock.toString(),
            topic0: COLLECT_TOPIC,
            topic2: tokenIdHex,
            apikey: 'placeholder',
        });
        const response = await fetch(`https://flarescan.com/api?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Flarescan logs request failed: ${response.status}`);
        }
        const data = await response.json();
        if (data.status !== '1' || !Array.isArray(data.result)) {
            return [];
        }
        return data.result.map((log) => {
            const dataHex = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
            const amount0 = parseInt(dataHex.slice(0, 64) || '0', 16);
            const amount1 = parseInt(dataHex.slice(64, 128) || '0', 16);
            return {
                blockNumber: parseInt(log.blockNumber, 16),
                transactionHash: log.transactionHash,
                timestamp: Number.parseInt(log.timeStamp, 10),
                amount0,
                amount1,
                tokenId: tokenIdHex,
            };
        });
    }
    catch (error) {
        console.error(`[COLLECT] Error fetching chunk ${fromBlock}-${toBlock}:`, error);
        return [];
    }
}
async function getLatestBlockNumber() {
    try {
        const response = await fetch('https://flarescan.com/api?module=proxy&action=eth_blockNumber&apikey=placeholder');
        if (!response.ok) {
            throw new Error(`Flarescan blockNumber request failed: ${response.status}`);
        }
        const data = await response.json();
        return parseInt(data.result, 16);
    }
    catch (error) {
        console.error('[COLLECT] Error fetching latest block number:', error);
        return 0;
    }
}
function clearCollectEventsCache(tokenId) {
    if (tokenId) {
        (0, memo_1.clearCache)(`collect-events-${tokenId}`);
    }
    else {
        (0, memo_1.clearCache)();
    }
}
