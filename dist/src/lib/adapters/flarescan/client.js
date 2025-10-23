"use strict";
/**
 * FlareScan API Client
 * Rate-limited, typed client for Flarescan/Blockscout API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchFlarescanV1 = fetchFlarescanV1;
exports.fetchFlarescanV2 = fetchFlarescanV2;
exports.postFlarescanV2 = postFlarescanV2;
exports.getContractCreation = getContractCreation;
exports.getTransactionInfo = getTransactionInfo;
exports.getNFTTransfers = getNFTTransfers;
exports.getEventLogs = getEventLogs;
exports.getContractInfo = getContractInfo;
exports.getTransaction = getTransaction;
exports.getNFTInstanceTransfers = getNFTInstanceTransfers;
exports.getLogsPOST = getLogsPOST;
const config_1 = require("../../onchain/config");
const timedFetch_1 = require("../../util/timedFetch");
const withTimeout_1 = require("../../util/withTimeout");
// API endpoints
const FLARESCAN_API_V1 = 'https://flare-explorer.flare.network/api';
const FLARESCAN_API_V2 = 'https://flare-explorer.flare.network/api/v2';
// Rate limiter: simple token bucket
class RateLimiter {
    constructor(requestsPerSecond) {
        this.maxTokens = requestsPerSecond;
        this.tokens = requestsPerSecond;
        this.lastRefill = Date.now();
        this.refillRate = requestsPerSecond / 1000; // Convert to tokens per ms
    }
    refill() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const tokensToAdd = elapsed * this.refillRate;
        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }
    async acquire() {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return;
        }
        // Wait until we have a token
        const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        this.tokens = 0; // We'll use the token we just waited for
    }
}
// Global rate limiter
const rateLimiter = new RateLimiter(config_1.RATE_LIMITS.FLARESCAN_RPS);
/**
 * Rate-limited fetch wrapper for Flarescan
 */
async function rateLimitedFetch(url, options) {
    await rateLimiter.acquire();
    return (0, withTimeout_1.withTimeout)((0, timedFetch_1.timedFetch)(url, options), 30000, `Flarescan request to ${url} timed out`);
}
/**
 * Fetch from Flarescan V1 API (Etherscan-compatible)
 */
async function fetchFlarescanV1(params) {
    const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
    const url = `${FLARESCAN_API_V1}?${query}`;
    const response = await rateLimitedFetch(url);
    if (!response.ok) {
        throw new Error(`[Flarescan V1] Request failed: ${response.status} ${response.statusText}`);
    }
    const json = await response.json();
    if (json.status === '0' && json.message !== 'No transactions found') {
        console.warn(`[Flarescan V1] API returned error: ${json.message}`, { params });
    }
    return json;
}
/**
 * Fetch from Flarescan V2 API (Blockscout REST)
 */
async function fetchFlarescanV2(path, params) {
    const query = params
        ? `?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))}`
        : '';
    const url = `${FLARESCAN_API_V2}${path}${query}`;
    const response = await rateLimitedFetch(url);
    if (!response.ok) {
        throw new Error(`[Flarescan V2] Request failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
}
/**
 * POST request to Flarescan V2 (for logs)
 */
async function postFlarescanV2(path, body) {
    const url = `${FLARESCAN_API_V2}${path}`;
    const response = await rateLimitedFetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(`[Flarescan V2 POST] Request failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
}
/**
 * Get contract creation info (V1 API)
 */
async function getContractCreation(contractAddress) {
    return fetchFlarescanV1({
        module: 'contract',
        action: 'getcontractcreation',
        contractaddresses: contractAddress,
    });
}
/**
 * Get transaction info (V1 API)
 */
async function getTransactionInfo(txHash) {
    return fetchFlarescanV1({
        module: 'transaction',
        action: 'gettxinfo',
        txhash: txHash,
    });
}
/**
 * Get NFT transfers (V1 API)
 */
async function getNFTTransfers(contractAddress, address, startBlock, endBlock) {
    const params = {
        module: 'account',
        action: 'tokennfttx',
        contractaddress: contractAddress,
    };
    if (address)
        params.address = address;
    if (startBlock !== undefined)
        params.startblock = startBlock;
    if (endBlock !== undefined)
        params.endblock = endBlock;
    return fetchFlarescanV1(params);
}
/**
 * Get event logs (V1 API)
 */
async function getEventLogs(address, fromBlock, toBlock, topics) {
    const params = {
        module: 'logs',
        action: 'getLogs',
        address,
        fromBlock,
        toBlock: String(toBlock),
    };
    if (topics && topics.length > 0) {
        topics.forEach((topic, index) => {
            if (topic)
                params[`topic${index}`] = topic;
        });
    }
    return fetchFlarescanV1(params);
}
/**
 * Get contract info (V2 API)
 */
async function getContractInfo(contractAddress) {
    return fetchFlarescanV2(`/smart-contracts/${contractAddress}`);
}
/**
 * Get transaction (V2 API)
 */
async function getTransaction(txHash) {
    return fetchFlarescanV2(`/transactions/${txHash}`);
}
/**
 * Get NFT instance transfers (V2 API)
 */
async function getNFTInstanceTransfers(contractAddress, tokenId, page = 1, pageSize = 100) {
    return fetchFlarescanV2(`/tokens/${contractAddress}/instances/${tokenId}/transfers`, {
        page,
        page_size: pageSize,
    });
}
/**
 * Get logs via POST (V2 API)
 */
async function getLogsPOST(address, fromBlock, toBlock, topics) {
    return postFlarescanV2('/logs', {
        address: [address],
        from_block: fromBlock,
        to_block: toBlock === 'latest' ? null : toBlock,
        topics: topics.reduce((acc, topic, index) => {
            if (topic)
                acc[`topic${index}`] = topic;
            return acc;
        }, {}),
    });
}
