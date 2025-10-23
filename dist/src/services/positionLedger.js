"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncPositionLedger = syncPositionLedger;
const client_1 = require("@prisma/client");
const positionEvents_1 = require("@/lib/data/positionEvents");
const positionTransfers_1 = require("@/lib/data/positionTransfers");
const flarescanService_1 = require("./flarescanService");
const rpcLogs_1 = require("@/lib/adapters/rpcLogs");
const viemClient_1 = require("@/lib/viemClient");
const blockTimestampCache = new Map();
async function resolveBlockTimestamp(blockNumber) {
    if (blockTimestampCache.has(blockNumber)) {
        return blockTimestampCache.get(blockNumber);
    }
    const block = await viemClient_1.publicClient.getBlock({ blockNumber: BigInt(blockNumber) });
    const ts = Number(block.timestamp);
    blockTimestampCache.set(blockNumber, ts);
    return ts;
}
function mapEventType(event) {
    switch (event.type) {
        case 'increase':
            return client_1.PositionEventType.INCREASE;
        case 'decrease':
            return client_1.PositionEventType.DECREASE;
        case 'collect':
            return client_1.PositionEventType.COLLECT;
        default:
            return client_1.PositionEventType.OTHER;
    }
}
async function syncPositionLedger({ tokenId, poolAddress, fromBlock, toBlock, refresh, seedTransfers, }) {
    const latestBlock = toBlock ?? (await (0, rpcLogs_1.fetchLatestBlockNumber)());
    const from = fromBlock ?? 0;
    const transfers = seedTransfers ??
        (await (0, flarescanService_1.getPositionNftTransfers)('0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657', tokenId, { refresh }));
    const managerEvents = await (0, flarescanService_1.getPositionManagerEvents)(tokenId, from, latestBlock, { refresh });
    const eventsPayload = await Promise.all(managerEvents.map(async (event) => ({
        id: `${event.txHash}:${event.logIndex}`,
        tokenId,
        pool: poolAddress.toLowerCase(),
        blockNumber: event.blockNumber,
        txHash: event.txHash,
        logIndex: event.logIndex,
        timestamp: event.timestamp ?? (await resolveBlockTimestamp(event.blockNumber)),
        eventType: mapEventType(event),
        sender: undefined,
        owner: undefined,
        recipient: event.recipient?.toLowerCase?.(),
        tickLower: undefined,
        tickUpper: undefined,
        tick: undefined,
        liquidityDelta: event.liquidity?.toString(),
        amount0: event.amount0?.toString(),
        amount1: event.amount1?.toString(),
        sqrtPriceX96: undefined,
        price1Per0: undefined,
        usdValue: undefined,
        metadata: undefined,
    })));
    await (0, positionEvents_1.bulkUpsertPositionEvents)(eventsPayload);
    const transfersPayload = await Promise.all(transfers.map(async (transfer, index) => ({
        id: `${transfer.txHash}:${index}`,
        tokenId,
        from: transfer.from.toLowerCase(),
        to: transfer.to.toLowerCase(),
        blockNumber: transfer.blockNumber,
        txHash: transfer.txHash,
        logIndex: index,
        timestamp: transfer.timestamp ?? (await resolveBlockTimestamp(transfer.blockNumber)),
        metadata: undefined,
    })));
    await (0, positionTransfers_1.bulkUpsertPositionTransfers)(transfersPayload);
    const [events, storedTransfers] = await Promise.all([
        (0, positionEvents_1.getPositionEvents)(tokenId),
        (0, positionTransfers_1.getPositionTransfers)(tokenId),
    ]);
    return {
        events,
        transfers: storedTransfers,
    };
}
