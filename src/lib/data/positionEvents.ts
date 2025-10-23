import { db } from '@/store/prisma';
import { PositionEvent, PositionEventType } from '@prisma/client';

export interface PositionEventData {
  id: string;
  tokenId: string;
  pool: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  timestamp: number;
  eventType: PositionEventType;
  sender?: string;
  owner?: string;
  recipient?: string;
  tickLower?: number;
  tickUpper?: number;
  tick?: number;
  liquidityDelta?: string;
  amount0?: string;
  amount1?: string;
  sqrtPriceX96?: string;
  price1Per0?: number;
  usdValue?: number;
  metadata?: Record<string, unknown>;
}

export async function upsertPositionEvent(data: PositionEventData): Promise<PositionEvent> {
  return await db.positionEvent.upsert({
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
      metadata: data.metadata as never,
    },
    create: {
      ...data,
      metadata: data.metadata as never,
    },
  });
}

export async function getPositionEvents(
  tokenId: string,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
    eventTypes?: PositionEventType[];
    limit?: number;
    offset?: number;
  } = {}
): Promise<PositionEvent[]> {
  const {
    fromTimestamp,
    toTimestamp,
    eventTypes,
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

  if (eventTypes && eventTypes.length > 0) {
    where.eventType = { in: eventTypes };
  }

  return await db.positionEvent.findMany({
    where: where as never,
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function getPositionEventsByPool(
  pool: string,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
    eventTypes?: PositionEventType[];
    limit?: number;
    offset?: number;
  } = {}
): Promise<PositionEvent[]> {
  const {
    fromTimestamp,
    toTimestamp,
    eventTypes,
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

  if (eventTypes && eventTypes.length > 0) {
    where.eventType = { in: eventTypes };
  }

  return await db.positionEvent.findMany({
    where: where as never,
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function getPositionEventsByWallet(
  walletAddress: string,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
    eventTypes?: PositionEventType[];
    limit?: number;
    offset?: number;
  } = {}
): Promise<PositionEvent[]> {
  const {
    fromTimestamp,
    toTimestamp,
    eventTypes,
    limit = 100,
    offset = 0,
  } = options;

  const where: Record<string, unknown> = { owner: walletAddress.toLowerCase() };

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

  if (eventTypes && eventTypes.length > 0) {
    where.eventType = { in: eventTypes };
  }

  return await db.positionEvent.findMany({
    where: where as never,
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function getPositionEventStats(
  tokenId: string,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
  } = {}
): Promise<{
  totalEvents: number;
  totalValueUsd: number;
  eventTypeCounts: Record<PositionEventType, number>;
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

  const [totalEvents, events] = await Promise.all([
    db.positionEvent.count({ where: where as never }),
    db.positionEvent.findMany({
      where: where as never,
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
  }, {} as Record<PositionEventType, number>);

  return {
    totalEvents,
    totalValueUsd,
    eventTypeCounts,
  };
}

export async function bulkUpsertPositionEvents(events: PositionEventData[]): Promise<void> {
  if (events.length === 0) return;

  // Use transaction for bulk operations
  await db.$transaction(
    events.map(event => 
      db.positionEvent.upsert({
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
          metadata: event.metadata as never,
        },
        create: {
          ...event,
          metadata: event.metadata as never,
        },
      })
    )
  );
}