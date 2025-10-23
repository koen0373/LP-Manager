"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLogsViaBlockscout = fetchLogsViaBlockscout;
const zod_1 = require("zod");
const rateLimit_1 = require("./rateLimit");
const logs_1 = require("./logs");
const BLOCKSCOUT_LOGS_ENDPOINT = 'https://flare-explorer.flare.network/api/v2/logs';
const blockscoutLogSchema = zod_1.z.object({
    address: zod_1.z.string(),
    data: zod_1.z.string(),
    topics: zod_1.z.array(zod_1.z.string()),
    transaction_hash: zod_1.z.string(),
    transaction_index: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    log_index: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    block_number: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    timestamp: zod_1.z.string().optional(),
});
const blockscoutResponseSchema = zod_1.z.object({
    items: zod_1.z.array(blockscoutLogSchema),
});
const toNumber = (value) => {
    if (typeof value === 'number')
        return value;
    if (value.startsWith('0x')) {
        return Number.parseInt(value.slice(2), 16);
    }
    return Number.parseInt(value, 10);
};
async function fetchLogsViaBlockscout(params) {
    const { address, fromBlock, toBlock, topics = [], chunkSize = 3000 } = params;
    const collected = [];
    for (let start = fromBlock; start <= toBlock; start += chunkSize + 1) {
        const end = Math.min(start + chunkSize, toBlock);
        const description = `Blockscout logs ${address} blocks ${start}-${end}`;
        const response = await (0, rateLimit_1.rateLimitedFetch)({
            description,
            request: () => fetch(BLOCKSCOUT_LOGS_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address,
                    fromBlock: start,
                    toBlock: end,
                    topics,
                }),
            }),
        });
        if (!response.ok) {
            throw new Error(`[Blockscout] ${description} failed with status ${response.status}`);
        }
        const parsed = blockscoutResponseSchema.safeParse(await response.json());
        if (!parsed.success) {
            console.warn('[Blockscout] Unexpected response shape', parsed.error.flatten());
            continue;
        }
        for (const item of parsed.data.items) {
            collected.push({
                address: item.address,
                data: item.data,
                topics: item.topics,
                transactionHash: item.transaction_hash,
                transactionIndex: toNumber(item.transaction_index),
                logIndex: toNumber(item.log_index),
                blockNumber: toNumber(item.block_number),
                timestamp: item.timestamp,
            });
        }
    }
    return (0, logs_1.dedupeLogs)(collected);
}
