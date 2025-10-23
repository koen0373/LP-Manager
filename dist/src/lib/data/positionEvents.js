"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertPositionEvent = upsertPositionEvent;
exports.getPositionEvents = getPositionEvents;
exports.getPositionEventsByPool = getPositionEventsByPool;
exports.getPositionEventsByWallet = getPositionEventsByWallet;
exports.getPositionEventStats = getPositionEventStats;
exports.bulkUpsertPositionEvents = bulkUpsertPositionEvents;
const prisma_1 = require("../../store/prisma");
async function upsertPositionEvent(data) {
    return await prisma_1.db.positionEvent.upsert({
        where: { id: data.id },
        update: {
            tokenId: data.tokenId,
            pool: data.pool,
            blockNumber: data.blockNumber,
            txHash: data.txHash,
            logIndex: data.logIndex,
            timestamp: data.timestamp,
            eventType: data.eventType,
            sender: data.sender,
            owner: data.owner,
            recipient: data.recipient,
            tickLower: data.tickLower,
            tickUpper: data.tickUpper,
            tick: data.tick,
            liquidityDelta: data.liquidityDelta,
            amount0: data.amount0,
            amount1: data.amount1,
            sqrtPriceX96: data.sqrtPriceX96,
            price1Per0: data.price1Per0,
            usdValue: data.usdValue,
            metadata: data.metadata,
        },
        create: {
            ...data,
            metadata: data.metadata,
        },
    });
}
async function getPositionEvents(tokenId, options = {}) {
    const { fromTimestamp, toTimestamp, eventTypes, limit = 100, offset = 0, } = options;
    const where = { tokenId };
    if (fromTimestamp !== undefined || toTimestamp !== undefined) {
        const timestampFilter = {};
        if (fromTimestamp !== undefined) {
            timestampFilter.gte = fromTimestamp;
        }
        if (toTimestamp !== undefined) {
            timestampFilter.lte = toTimestamp;
        }
        where.timestamp = timestampFilter;
    }
    if (eventTypes && eventTypes.length > 0) {
        where.eventType = { in: eventTypes };
    }
    return await prisma_1.db.positionEvent.findMany({
        where: where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
    });
}
async function getPositionEventsByPool(pool, options = {}) {
    const { fromTimestamp, toTimestamp, eventTypes, limit = 100, offset = 0, } = options;
    const where = { pool };
    if (fromTimestamp !== undefined || toTimestamp !== undefined) {
        const timestampFilter = {};
        if (fromTimestamp !== undefined) {
            timestampFilter.gte = fromTimestamp;
        }
        if (toTimestamp !== undefined) {
            timestampFilter.lte = toTimestamp;
        }
        where.timestamp = timestampFilter;
    }
    if (eventTypes && eventTypes.length > 0) {
        where.eventType = { in: eventTypes };
    }
    return await prisma_1.db.positionEvent.findMany({
        where: where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
    });
}
async function getPositionEventsByWallet(walletAddress, options = {}) {
    const { fromTimestamp, toTimestamp, eventTypes, limit = 100, offset = 0, } = options;
    const where = { owner: walletAddress.toLowerCase() };
    if (fromTimestamp !== undefined || toTimestamp !== undefined) {
        const timestampFilter = {};
        if (fromTimestamp !== undefined) {
            timestampFilter.gte = fromTimestamp;
        }
        if (toTimestamp !== undefined) {
            timestampFilter.lte = toTimestamp;
        }
        where.timestamp = timestampFilter;
    }
    if (eventTypes && eventTypes.length > 0) {
        where.eventType = { in: eventTypes };
    }
    return await prisma_1.db.positionEvent.findMany({
        where: where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
    });
}
async function getPositionEventStats(tokenId, options = {}) {
    const { fromTimestamp, toTimestamp } = options;
    const where = { tokenId };
    if (fromTimestamp !== undefined || toTimestamp !== undefined) {
        const timestampFilter = {};
        if (fromTimestamp !== undefined) {
            timestampFilter.gte = fromTimestamp;
        }
        if (toTimestamp !== undefined) {
            timestampFilter.lte = toTimestamp;
        }
        where.timestamp = timestampFilter;
    }
    const [totalEvents, events] = await Promise.all([
        prisma_1.db.positionEvent.count({ where: where }),
        prisma_1.db.positionEvent.findMany({
            where: where,
            select: {
                eventType: true,
                usdValue: true,
            },
        }),
    ]);
    const totalValueUsd = events.reduce((sum, event) => sum + (event.usdValue || 0), 0);
    const eventTypeCounts = events.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
    }, {});
    return {
        totalEvents,
        totalValueUsd,
        eventTypeCounts,
    };
}
async function bulkUpsertPositionEvents(events) {
    if (events.length === 0)
        return;
    // Use transaction for bulk operations
    await prisma_1.db.$transaction(events.map(event => prisma_1.db.positionEvent.upsert({
        where: { id: event.id },
        update: {
            tokenId: event.tokenId,
            pool: event.pool,
            blockNumber: event.blockNumber,
            txHash: event.txHash,
            logIndex: event.logIndex,
            timestamp: event.timestamp,
            eventType: event.eventType,
            sender: event.sender,
            owner: event.owner,
            recipient: event.recipient,
            tickLower: event.tickLower,
            tickUpper: event.tickUpper,
            tick: event.tick,
            liquidityDelta: event.liquidityDelta,
            amount0: event.amount0,
            amount1: event.amount1,
            sqrtPriceX96: event.sqrtPriceX96,
            price1Per0: event.price1Per0,
            usdValue: event.usdValue,
            metadata: event.metadata,
        },
        create: {
            ...event,
            metadata: event.metadata,
        },
    })));
}
