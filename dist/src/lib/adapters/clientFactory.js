"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultClient = void 0;
exports.createClientWithFallback = createClientWithFallback;
const viem_1 = require("viem");
const chainFlare_1 = require("../chainFlare");
const DEFAULT_ENDPOINTS = [
    'https://flare.flr.finance/ext/bc/C/rpc',
    'https://flare.public-rpc.com',
    'https://rpc.ftso.com',
];
const endpoints = process.env.NEXT_PUBLIC_RPC_URL
    ? [process.env.NEXT_PUBLIC_RPC_URL, ...DEFAULT_ENDPOINTS]
    : DEFAULT_ENDPOINTS;
exports.defaultClient = (0, viem_1.createPublicClient)({
    chain: chainFlare_1.flare,
    transport: (0, viem_1.fallback)(endpoints.map((url) => (0, viem_1.http)(url, { batch: { wait: 20 } }))),
    batch: { multicall: false },
});
function createClientWithFallback(customEndpoints) {
    const resolved = customEndpoints && customEndpoints.length > 0 ? customEndpoints : endpoints;
    return (0, viem_1.createPublicClient)({
        chain: chainFlare_1.flare,
        transport: (0, viem_1.fallback)(resolved.map((url) => (0, viem_1.http)(url, { batch: { wait: 20 } }))),
        batch: { multicall: false },
    });
}
