import { db } from '@/store/prisma';
import { PositionTransfer } from '@prisma/client';

export interface PositionTransferData {
  id: string;
  tokenId: string;
  from: string;
  to: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export async function upsertPositionTransfer(data: PositionTransferData): Promise<PositionTransfer> {
  return await db.positionTransfer.upsert({
    where: { id: data.id },
    update: {
      tokenId: data.tokenId,
      from: data.from,
      to: data.to,
      blockNumber: data.blockNumber,
      txHash: data.txHash,
      logIndex: data.logIndex,
      timestamp: data.timestamp,
      metadata: data.metadata as never,
    },
    create: {
      ...data,
      metadata: data.metadata as never,
    },
  });
}

export async function getPositionTransfers(
  tokenId: string,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<PositionTransfer[]> {
  const {
    fromTimestamp,
    toTimestamp,
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

  return await db.positionTransfer.findMany({
    where: where as never,
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function getPositionTransfersByWallet(
  wallet: string,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<PositionTransfer[]> {
  const {
    fromTimestamp,
    toTimestamp,
    limit = 100,
    offset = 0,
  } = options;

  const where: Record<string, unknown> = {
    OR: [
      { from: wallet },
      { to: wallet },
    ],
  };

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

  return await db.positionTransfer.findMany({
    where: where as never,
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function getPositionOwnershipHistory(
  tokenId: string,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<PositionTransfer[]> {
  const {
    fromTimestamp,
    toTimestamp,
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

  return await db.positionTransfer.findMany({
    where: where as never,
    orderBy: { timestamp: 'asc' }, // Chronological order for ownership history
    take: limit,
    skip: offset,
  });
}

export async function getCurrentPositionOwner(tokenId: string): Promise<string | null> {
  const latestTransfer = await db.positionTransfer.findFirst({
    where: { tokenId },
    orderBy: { timestamp: 'desc' },
  });

  return latestTransfer?.to || null;
}

export async function getPositionTransferStats(
  tokenId: string,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
  } = {}
): Promise<{
  totalTransfers: number;
  uniqueOwners: number;
  firstTransfer?: PositionTransfer;
  lastTransfer?: PositionTransfer;
}> {
  const { fromTimestamp, toTimestamp } = options;

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

  const [totalTransfers, transfers, firstTransfer, lastTransfer] = await Promise.all([
    db.positionTransfer.count({ where: where as never }),
    db.positionTransfer.findMany({
      where: where as never,
      select: { to: true },
    }),
    db.positionTransfer.findFirst({
      where: where as never,
      orderBy: { timestamp: 'asc' },
    }),
    db.positionTransfer.findFirst({
      where: where as never,
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

export async function bulkUpsertPositionTransfers(transfers: PositionTransferData[]): Promise<void> {
  if (transfers.length === 0) return;

  // Use transaction for bulk operations
  await db.$transaction(
    transfers.map(transfer => 
      db.positionTransfer.upsert({
        where: { id: transfer.id },
        update: {
          tokenId: transfer.tokenId,
          from: transfer.from,
          to: transfer.to,
          blockNumber: transfer.blockNumber,
          txHash: transfer.txHash,
          logIndex: transfer.logIndex,
          timestamp: transfer.timestamp,
          metadata: transfer.metadata as never,
        },
        create: {
          ...transfer,
          metadata: transfer.metadata as never,
        },
      })
    )
  );
}