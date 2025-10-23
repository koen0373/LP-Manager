"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLogsViaRpc = fetchLogsViaRpc;
exports.fetchLatestBlockNumber = fetchLatestBlockNumber;
const zod_1 = require("zod");
const rateLimit_1 = require("./rateLimit");
const logs_1 = require("./logs");
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_URL || 'https://flare.flr.finance/ext/bc/C/rpc';
const rpcLogSchema = zod_1.z.object({
    address: zod_1.z.string(),
    data: zod_1.z.string(),
    topics: zod_1.z.array(zod_1.z.string()),
    blockNumber: zod_1.z.string(),
    transactionHash: zod_1.z.string(),
    transactionIndex: zod_1.z.string(),
    logIndex: zod_1.z.string(),
});
const rpcResponseSchema = zod_1.z.object({
    jsonrpc: zod_1.z.literal('2.0'),
    id: zod_1.z.number(),
    result: zod_1.z.array(rpcLogSchema).optional(),
    error: zod_1.z
        .object({
        code: zod_1.z.number(),
        message: zod_1.z.string(),
    })
        .optional(),
});
const fromHex = (value) => Number.parseInt(value, 16);
const blockNumberResponseSchema = zod_1.z.object({
    jsonrpc: zod_1.z.literal('2.0'),
    id: zod_1.z.number(),
    result: zod_1.z.string().optional(),
    error: zod_1.z
        .object({
        code: zod_1.z.number(),
        message: zod_1.z.string(),
    })
        .optional(),
});
async function fetchLogsViaRpc(params) {
    const { address, fromBlock, toBlock, topics = [], chunkSize = 3000 } = params;
    const collected = [];
    for (let start = fromBlock; start <= toBlock; start += chunkSize + 1) {
        const end = Math.min(start + chunkSize, toBlock);
        const description = `RPC logs ${address} blocks ${start}-${end}`;
        const response = await (0, rateLimit_1.rateLimitedFetch)({
            description,
            request: () => fetch(RPC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_getLogs',
                    params: [
                        {
                            address,
                            fromBlock: (0, rateLimit_1.toHex)(start),
                            toBlock: (0, rateLimit_1.toHex)(end),
                            topics,
                        },
                    ],
                }),
            }),
        });
        if (!response.ok) {
            throw new Error(`[RPC] ${description} failed with status ${response.status}`);
        }
        const payload = rpcResponseSchema.parse(await response.json());
        if (payload.error) {
            throw new Error(`[RPC] ${description} failed: ${payload.error.message}`);
        }
        for (const log of payload.result ?? []) {
            collected.push({
                address: log.address,
                data: log.data,
                topics: log.topics,
                transactionHash: log.transactionHash,
                transactionIndex: fromHex(log.transactionIndex),
                logIndex: fromHex(log.logIndex),
                blockNumber: fromHex(log.blockNumber),
            });
        }
    }
    return (0, logs_1.dedupeLogs)(collected);
}
async function fetchLatestBlockNumber() {
    const response = await (0, rateLimit_1.rateLimitedFetch)({
        description: 'eth_blockNumber',
        request: () => fetch(RPC_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_blockNumber',
                params: [],
            }),
        }),
    });
    if (!response.ok) {
        throw new Error(`[RPC] eth_blockNumber failed with status ${response.status}`);
    }
    const payload = blockNumberResponseSchema.parse(await response.json());
    if (payload.error || !payload.result) {
        throw new Error(`[RPC] eth_blockNumber failed: ${payload.error?.message ?? 'No result'}`);
    }
    return fromHex(payload.result);
}
