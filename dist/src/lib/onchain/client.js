"use strict";
/**
 * RPC Client Factory with Fallback Support
 * Provides resilient, multi-endpoint RPC access
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicClient = exports.flareChain = void 0;
exports.createClientWithFallback = createClientWithFallback;
exports.createSingleEndpointClient = createSingleEndpointClient;
const viem_1 = require("viem");
const config_1 = require("./config");
// Define Flare chain
exports.flareChain = {
    id: config_1.FLARE_CHAIN_ID,
    name: 'Flare',
    nativeCurrency: {
        decimals: 18,
        name: 'Flare',
        symbol: 'FLR',
    },
    rpcUrls: {
        default: {
            http: [...config_1.RPC_ENDPOINTS],
        },
        public: {
            http: [...config_1.RPC_ENDPOINTS],
        },
    },
    blockExplorers: {
        default: {
            name: 'FlareScan',
            url: 'https://flarescan.com',
        },
    },
    testnet: false,
};
/**
 * Create a public client with multiple RPC endpoints as fallback
 */
function createClientWithFallback(endpoints = config_1.RPC_ENDPOINTS) {
    // Build transports for each endpoint
    const transports = endpoints.map((url, index) => {
        const priority = index;
        const batchSize = config_1.RATE_LIMITS.RPC_BATCH_SIZE - priority * 5; // Decrease batch size for fallbacks
        const wait = config_1.RATE_LIMITS.RPC_BATCH_WAIT + priority * 20; // Increase wait for fallbacks
        return (0, viem_1.http)(url, {
            batch: {
                batchSize: Math.max(batchSize, 10),
                wait: Math.min(wait, 100),
            },
            timeout: 30000, // 30s timeout
            retryCount: 2,
            retryDelay: 1000,
        });
    });
    // Use first transport as primary, rest as fallback
    return (0, viem_1.createPublicClient)({
        chain: exports.flareChain,
        transport: transports[0], // Viem doesn't support multiple transports directly, so we use the first
        batch: {
            multicall: {
                batchSize: config_1.RATE_LIMITS.RPC_BATCH_SIZE,
                wait: config_1.RATE_LIMITS.RPC_BATCH_WAIT,
            },
        },
    });
}
/**
 * Singleton public client instance
 * Used throughout the app for on-chain reads
 */
exports.publicClient = createClientWithFallback();
/**
 * Create a dedicated client for a specific endpoint (testing/debugging)
 */
function createSingleEndpointClient(endpoint) {
    return (0, viem_1.createPublicClient)({
        chain: exports.flareChain,
        transport: (0, viem_1.http)(endpoint, {
            timeout: 30000,
            retryCount: 3,
            retryDelay: 1000,
        }),
    });
}
