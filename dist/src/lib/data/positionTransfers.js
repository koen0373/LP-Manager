"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertPositionTransfer = upsertPositionTransfer;
exports.getPositionTransfers = getPositionTransfers;
exports.getPositionTransfersByWallet = getPositionTransfersByWallet;
exports.getPositionOwnershipHistory = getPositionOwnershipHistory;
exports.getCurrentPositionOwner = getCurrentPositionOwner;
exports.getPositionTransferStats = getPositionTransferStats;
exports.bulkUpsertPositionTransfers = bulkUpsertPositionTransfers;
const prisma_1 = require("../../store/prisma");
async function upsertPositionTransfer(data) {
    return await prisma_1.db.positionTransfer.upsert({
        where: { id: data.id },
        update: {
            tokenId: data.tokenId,
            from: data.from,
            to: data.to,
            blockNumber: data.blockNumber,
            txHash: data.txHash,
            logIndex: data.logIndex,
            timestamp: data.timestamp,
            metadata: data.metadata,
        },
        create: {
            ...data,
            metadata: data.metadata,
        },
    });
}
async function getPositionTransfers(tokenId, options = {}) {
    const { fromTimestamp, toTimestamp, limit = 100, offset = 0, } = options;
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
    return await prisma_1.db.positionTransfer.findMany({
        where: where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
    });
}
async function getPositionTransfersByWallet(wallet, options = {}) {
    const { fromTimestamp, toTimestamp, limit = 100, offset = 0, } = options;
    const where = {
        OR: [
            { from: wallet },
            { to: wallet },
        ],
    };
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
    return await prisma_1.db.positionTransfer.findMany({
        where: where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
    });
}
async function getPositionOwnershipHistory(tokenId, options = {}) {
    const { fromTimestamp, toTimestamp, limit = 100, offset = 0, } = options;
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
    return await prisma_1.db.positionTransfer.findMany({
        where: where,
        orderBy: { timestamp: 'asc' }, // Chronological order for ownership history
        take: limit,
        skip: offset,
    });
}
async function getCurrentPositionOwner(tokenId) {
    const latestTransfer = await prisma_1.db.positionTransfer.findFirst({
        where: { tokenId },
        orderBy: { timestamp: 'desc' },
    });
    return latestTransfer?.to || null;
}
async function getPositionTransferStats(tokenId, options = {}) {
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
    const [totalTransfers, transfers, firstTransfer, lastTransfer] = await Promise.all([
        prisma_1.db.positionTransfer.count({ where: where }),
        prisma_1.db.positionTransfer.findMany({
            where: where,
            select: { to: true },
        }),
        prisma_1.db.positionTransfer.findFirst({
            where: where,
            orderBy: { timestamp: 'asc' },
        }),
        prisma_1.db.positionTransfer.findFirst({
            where: where,
            orderBy: { timestamp: 'desc' },
        }),
    ]);
    const uniqueOwners = new Set(transfers.map(t => t.to)).size;
    return {
        totalTransfers,
        uniqueOwners,
        firstTransfer: firstTransfer || undefined,
        lastTransfer: lastTransfer || undefined,
    };
}
async function bulkUpsertPositionTransfers(transfers) {
    if (transfers.length === 0)
        return;
    // Use transaction for bulk operations
    await prisma_1.db.$transaction(transfers.map(transfer => prisma_1.db.positionTransfer.upsert({
        where: { id: transfer.id },
        update: {
            tokenId: transfer.tokenId,
            from: transfer.from,
            to: transfer.to,
            blockNumber: transfer.blockNumber,
            txHash: transfer.txHash,
            logIndex: transfer.logIndex,
            timestamp: transfer.timestamp,
            metadata: transfer.metadata,
        },
        create: {
            ...transfer,
            metadata: transfer.metadata,
        },
    })));
}
