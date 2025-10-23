"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertCapitalFlow = upsertCapitalFlow;
exports.getCapitalFlows = getCapitalFlows;
exports.getCapitalFlowsByToken = getCapitalFlowsByToken;
exports.getCapitalFlowsByPool = getCapitalFlowsByPool;
exports.getCapitalFlowStats = getCapitalFlowStats;
exports.getCapitalFlowSummary = getCapitalFlowSummary;
exports.bulkUpsertCapitalFlows = bulkUpsertCapitalFlows;
const prisma_1 = require("@/store/prisma");
async function upsertCapitalFlow(data) {
    return await prisma_1.db.capitalFlow.upsert({
        where: { id: data.id },
        update: {
            wallet: data.wallet,
            tokenId: data.tokenId,
            pool: data.pool,
            flowType: data.flowType,
            amountUsd: data.amountUsd,
            amount0: data.amount0,
            amount1: data.amount1,
            timestamp: data.timestamp,
            txHash: data.txHash,
            relatedTx: data.relatedTx,
            metadata: data.metadata,
        },
        create: {
            ...data,
            metadata: data.metadata,
        },
    });
}
async function getCapitalFlows(wallet, options = {}) {
    const { fromTimestamp, toTimestamp, flowTypes, tokenId, pool, limit = 100, offset = 0, } = options;
    const where = { wallet };
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
    if (flowTypes && flowTypes.length > 0) {
        where.flowType = { in: flowTypes };
    }
    if (tokenId) {
        where.tokenId = tokenId;
    }
    if (pool) {
        where.pool = pool;
    }
    return await prisma_1.db.capitalFlow.findMany({
        where: where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
    });
}
async function getCapitalFlowsByToken(tokenId, options = {}) {
    const { fromTimestamp, toTimestamp, flowTypes, limit = 100, offset = 0, } = options;
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
    if (flowTypes && flowTypes.length > 0) {
        where.flowType = { in: flowTypes };
    }
    return await prisma_1.db.capitalFlow.findMany({
        where: where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
    });
}
async function getCapitalFlowsByPool(pool, options = {}) {
    const { fromTimestamp, toTimestamp, flowTypes, limit = 100, offset = 0, } = options;
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
    if (flowTypes && flowTypes.length > 0) {
        where.flowType = { in: flowTypes };
    }
    return await prisma_1.db.capitalFlow.findMany({
        where: where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
    });
}
async function getCapitalFlowStats(wallet, options = {}) {
    const { fromTimestamp, toTimestamp, tokenId, pool } = options;
    const where = { wallet };
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
    if (tokenId) {
        where.tokenId = tokenId;
    }
    if (pool) {
        where.pool = pool;
    }
    const [totalFlows, flows] = await Promise.all([
        prisma_1.db.capitalFlow.count({ where: where }),
        prisma_1.db.capitalFlow.findMany({
            where: where,
            select: {
                flowType: true,
                amountUsd: true,
            },
        }),
    ]);
    const totalDepositsUsd = flows
        .filter(f => f.flowType === 'DEPOSIT')
        .reduce((sum, f) => sum + f.amountUsd, 0);
    const totalWithdrawalsUsd = flows
        .filter(f => f.flowType === 'WITHDRAW')
        .reduce((sum, f) => sum + f.amountUsd, 0);
    const totalFeesRealizedUsd = flows
        .filter(f => f.flowType === 'FEES_REALIZED')
        .reduce((sum, f) => sum + f.amountUsd, 0);
    const totalFeesReinvestedUsd = flows
        .filter(f => f.flowType === 'FEES_REINVESTED')
        .reduce((sum, f) => sum + f.amountUsd, 0);
    const netFlowUsd = totalDepositsUsd - totalWithdrawalsUsd + totalFeesRealizedUsd + totalFeesReinvestedUsd;
    const flowTypeCounts = flows.reduce((acc, flow) => {
        acc[flow.flowType] = (acc[flow.flowType] || 0) + 1;
        return acc;
    }, {});
    return {
        totalFlows,
        totalDepositsUsd,
        totalWithdrawalsUsd,
        totalFeesRealizedUsd,
        totalFeesReinvestedUsd,
        netFlowUsd,
        flowTypeCounts,
    };
}
async function getCapitalFlowSummary(wallet, options = {}) {
    const stats = await getCapitalFlowStats(wallet, options);
    const totalDepositedUsd = stats.totalDepositsUsd;
    const totalWithdrawnUsd = stats.totalWithdrawalsUsd;
    const totalFeesEarnedUsd = stats.totalFeesRealizedUsd;
    const totalFeesReinvestedUsd = stats.totalFeesReinvestedUsd;
    // Current value would need to be calculated from current position values
    // This is a placeholder - would need integration with position data
    const currentValueUsd = 0; // TODO: Calculate from current positions
    const totalReturnUsd = currentValueUsd - totalDepositedUsd + totalWithdrawnUsd + totalFeesEarnedUsd;
    const totalReturnPercent = totalDepositedUsd > 0 ? (totalReturnUsd / totalDepositedUsd) * 100 : 0;
    return {
        totalDepositedUsd,
        totalWithdrawnUsd,
        totalFeesEarnedUsd,
        totalFeesReinvestedUsd,
        currentValueUsd,
        totalReturnUsd,
        totalReturnPercent,
    };
}
async function bulkUpsertCapitalFlows(flows) {
    if (flows.length === 0)
        return;
    // Use transaction for bulk operations
    await prisma_1.db.$transaction(flows.map(flow => prisma_1.db.capitalFlow.upsert({
        where: { id: flow.id },
        update: {
            wallet: flow.wallet,
            tokenId: flow.tokenId,
            pool: flow.pool,
            flowType: flow.flowType,
            amountUsd: flow.amountUsd,
            amount0: flow.amount0,
            amount1: flow.amount1,
            timestamp: flow.timestamp,
            txHash: flow.txHash,
            relatedTx: flow.relatedTx,
            metadata: flow.metadata,
        },
        create: {
            ...flow,
            metadata: flow.metadata,
        },
    })));
}
