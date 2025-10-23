import { db } from '@/store/prisma';
import { CapitalFlow, CapitalFlowType } from '@prisma/client';

export interface CapitalFlowData {
  id: string;
  wallet: string;
  tokenId?: string;
  pool?: string;
  flowType: CapitalFlowType;
  amountUsd: number;
  amount0?: string;
  amount1?: string;
  timestamp: number;
  txHash: string;
  relatedTx?: string;
  metadata?: Record<string, unknown>;
}

export async function upsertCapitalFlow(data: CapitalFlowData): Promise<CapitalFlow> {
  return await db.capitalFlow.upsert({
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
      metadata: data.metadata as never,
    },
    create: {
      ...data,
      metadata: data.metadata as never,
    },
  });
}

export async function getCapitalFlows(
  wallet: string,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
    flowTypes?: CapitalFlowType[];
    tokenId?: string;
    pool?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<CapitalFlow[]> {
  const {
    fromTimestamp,
    toTimestamp,
    flowTypes,
    tokenId,
    pool,
    limit = 100,
    offset = 0,
  } = options;

  const where: Record<string, unknown> = { wallet };

  if (fromTimestamp !== undefined || toTimestamp !== undefined) {
    const timestampFilter: Record<string, number> = {};
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

  return await db.capitalFlow.findMany({
    where: where as never,
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function getCapitalFlowsByToken(
  tokenId: string,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
    flowTypes?: CapitalFlowType[];
    limit?: number;
    offset?: number;
  } = {}
): Promise<CapitalFlow[]> {
  const {
    fromTimestamp,
    toTimestamp,
    flowTypes,
    limit = 100,
    offset = 0,
  } = options;

  const where: Record<string, unknown> = { tokenId };

  if (fromTimestamp !== undefined || toTimestamp !== undefined) {
    const timestampFilter: Record<string, number> = {};
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

  return await db.capitalFlow.findMany({
    where: where as never,
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function getCapitalFlowsByPool(
  pool: string,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
    flowTypes?: CapitalFlowType[];
    limit?: number;
    offset?: number;
  } = {}
): Promise<CapitalFlow[]> {
  const {
    fromTimestamp,
    toTimestamp,
    flowTypes,
    limit = 100,
    offset = 0,
  } = options;

  const where: Record<string, unknown> = { pool };

  if (fromTimestamp !== undefined || toTimestamp !== undefined) {
    const timestampFilter: Record<string, number> = {};
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

  return await db.capitalFlow.findMany({
    where: where as never,
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function getCapitalFlowStats(
  wallet: string,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
    tokenId?: string;
    pool?: string;
  } = {}
): Promise<{
  totalFlows: number;
  totalDepositsUsd: number;
  totalWithdrawalsUsd: number;
  totalFeesRealizedUsd: number;
  totalFeesReinvestedUsd: number;
  netFlowUsd: number;
  flowTypeCounts: Record<CapitalFlowType, number>;
}> {
  const { fromTimestamp, toTimestamp, tokenId, pool } = options;

  const where: Record<string, unknown> = { wallet };

  if (fromTimestamp !== undefined || toTimestamp !== undefined) {
    const timestampFilter: Record<string, number> = {};
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
    db.capitalFlow.count({ where: where as never }),
    db.capitalFlow.findMany({
      where: where as never,
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
  }, {} as Record<CapitalFlowType, number>);

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

export async function getCapitalFlowSummary(
  wallet: string,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
  } = {}
): Promise<{
  totalDepositedUsd: number;
  totalWithdrawnUsd: number;
  totalFeesEarnedUsd: number;
  totalFeesReinvestedUsd: number;
  currentValueUsd: number;
  totalReturnUsd: number;
  totalReturnPercent: number;
}> {
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

export async function bulkUpsertCapitalFlows(flows: CapitalFlowData[]): Promise<void> {
  if (flows.length === 0) return;

  // Use transaction for bulk operations
  await db.$transaction(
    flows.map(flow => 
      db.capitalFlow.upsert({
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
          metadata: flow.metadata as never,
        },
        create: {
          ...flow,
          metadata: flow.metadata as never,
        },
      })
    )
  );
}