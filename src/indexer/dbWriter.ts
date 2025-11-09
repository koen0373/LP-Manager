/**
 * Database Writer
 * 
 * Efficiently writes decoded events to database with batching and deduplication
 */

import { PrismaClient } from '@prisma/client';
import { DecodedEvent, DecodedTransfer, DecodedPositionEvent } from './eventDecoder';
import { indexerConfig } from '../../indexer.config';

export interface WriteStats {
  transfersWritten: number;
  eventsWritten: number;
  duplicates: number;
  errors: number;
}

export interface PoolEventRow {
  id: string;
  pool: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  timestamp: number;
  eventName: string;
  sender?: string | null;
  owner?: string | null;
  recipient?: string | null;
  tickLower?: number | null;
  tickUpper?: number | null;
  amount?: string | null;
  amount0?: string | null;
  amount1?: string | null;
  sqrtPriceX96?: string | null;
  liquidity?: string | null;
  tick?: number | null;
}

export class DbWriter {
  constructor(private prisma: PrismaClient) {}

  /**
   * Write decoded events to database in batches
   */
  async write(events: DecodedEvent[], timestamp: number, pool = 'unknown'): Promise<WriteStats> {
    const stats: WriteStats = {
      transfersWritten: 0,
      eventsWritten: 0,
      duplicates: 0,
      errors: 0,
    };

    // Separate transfers and position events
    const transfers: DecodedTransfer[] = [];
    const positionEvents: DecodedPositionEvent[] = [];

    for (const event of events) {
      if (event.type === 'TRANSFER') {
        transfers.push(event);
      } else {
        positionEvents.push(event);
      }
    }

    // Write in batches
    const batchSize = indexerConfig.db.batchSize;

    // Write transfers
    for (let i = 0; i < transfers.length; i += batchSize) {
      const batch = transfers.slice(i, i + batchSize);
      const result = await this.writeTransferBatch(batch, timestamp);
      stats.transfersWritten += result.written;
      stats.duplicates += result.duplicates;
      stats.errors += result.errors;
    }

    // Write position events
    for (let i = 0; i < positionEvents.length; i += batchSize) {
      const batch = positionEvents.slice(i, i + batchSize);
      const result = await this.writePositionEventBatch(batch, timestamp, pool);
      stats.eventsWritten += result.written;
      stats.duplicates += result.duplicates;
      stats.errors += result.errors;
    }

    return stats;
  }

  async writePoolEvents(
    events: PoolEventRow[]
  ): Promise<{ written: number; duplicates: number; errors: number }> {
    if (events.length === 0) {
      return { written: 0, duplicates: 0, errors: 0 };
    }

    const batchSize = indexerConfig.db.batchSize;
    let written = 0;

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize).map((event) => ({
        id: event.id,
        pool: event.pool,
        blockNumber: event.blockNumber,
        txHash: event.txHash,
        logIndex: event.logIndex,
        timestamp: event.timestamp,
        eventName: event.eventName,
        sender: event.sender ?? null,
        owner: event.owner ?? null,
        recipient: event.recipient ?? null,
        tickLower: event.tickLower ?? null,
        tickUpper: event.tickUpper ?? null,
        amount: event.amount ?? null,
        amount0: event.amount0 ?? null,
        amount1: event.amount1 ?? null,
        sqrtPriceX96: event.sqrtPriceX96 ?? null,
        liquidity: event.liquidity ?? null,
        tick: event.tick ?? null,
      }));
      try {
        const result = await this.prisma.poolEvent.createMany({
          data: batch,
          skipDuplicates: true,
        });
        written += result.count;
      } catch (error: unknown) {
        console.error('[DB] Error writing pool event batch:', error);
        return { written, duplicates: 0, errors: batch.length };
      }
    }

    return { written, duplicates: 0, errors: 0 };
  }

  /**
   * Write a batch of transfers
   */
  private async writeTransferBatch(
    transfers: DecodedTransfer[],
    timestamp: number
  ): Promise<{ written: number; duplicates: number; errors: number }> {
    let written = 0;
    let duplicates = 0;
    let errors = 0;

    try {
      await this.prisma.$transaction(
        transfers.map((transfer) =>
          this.prisma.positionTransfer.upsert({
            where: {
              txHash_logIndex: {
                txHash: transfer.txHash,
                logIndex: transfer.logIndex,
              },
            },
            create: {
              id: `${transfer.txHash}:${transfer.logIndex}`,
              tokenId: transfer.tokenId,
              from: transfer.from,
              to: transfer.to,
              blockNumber: transfer.blockNumber,
              txHash: transfer.txHash,
              logIndex: transfer.logIndex,
              timestamp,
              nfpmAddress: transfer.nfpmAddress,
            },
            update: {}, // No-op on duplicate
          })
        )
      );

      written = transfers.length;
    } catch (error: unknown) {
      // Handle unique constraint violations
      if ((error as { code?: string }).code === 'P2002') {
        duplicates = transfers.length;
      } else {
        console.error('[DB] Error writing transfer batch:', error);
        errors = transfers.length;
      }
    }

    return { written, duplicates, errors };
  }

  /**
   * Write a batch of position events
   */
  private async writePositionEventBatch(
    events: DecodedPositionEvent[],
    timestamp: number,
    pool: string
  ): Promise<{ written: number; duplicates: number; errors: number }> {
    let written = 0;
    let duplicates = 0;
    let errors = 0;

    try {
      await this.prisma.$transaction(
        events.map((event) =>
          this.prisma.positionEvent.upsert({
            where: {
              txHash_logIndex: {
                txHash: event.txHash,
                logIndex: event.logIndex,
              },
            },
            create: {
              id: `${event.txHash}:${event.logIndex}`,
              tokenId: event.tokenId,
              pool,
              blockNumber: event.blockNumber,
              txHash: event.txHash,
              logIndex: event.logIndex,
              timestamp,
              eventType: event.type,
              recipient: event.recipient,
              amount0: event.amount0,
              amount1: event.amount1,
              liquidityDelta: event.liquidityDelta,
            },
            update: {}, // No-op on duplicate
          })
        )
      );

      written = events.length;
    } catch (error: unknown) {
      // Handle unique constraint violations
      if ((error as { code?: string }).code === 'P2002') {
        duplicates = events.length;
      } else {
        console.error('[DB] Error writing position event batch:', error);
        errors = events.length;
      }
    }

    return { written, duplicates, errors };
  }

  /**
   * Get total event count for a tokenId
   */
  async getEventCount(tokenId: string): Promise<number> {
    const [transferCount, eventCount] = await Promise.all([
      this.prisma.positionTransfer.count({
        where: { tokenId },
      }),
      this.prisma.positionEvent.count({
        where: { tokenId },
      }),
    ]);

    return transferCount + eventCount;
  }

  /**
   * Get block range for a tokenId
   */
  async getBlockRange(tokenId: string): Promise<{ min: number; max: number } | null> {
    const [transferRange, eventRange] = await Promise.all([
      this.prisma.positionTransfer.aggregate({
        where: { tokenId },
        _min: { blockNumber: true },
        _max: { blockNumber: true },
      }),
      this.prisma.positionEvent.aggregate({
        where: { tokenId },
        _min: { blockNumber: true },
        _max: { blockNumber: true },
      }),
    ]);

    const minBlock = Math.min(transferRange._min.blockNumber ?? Infinity, eventRange._min.blockNumber ?? Infinity);
    const maxBlock = Math.max(transferRange._max.blockNumber ?? 0, eventRange._max.blockNumber ?? 0);

    if (minBlock === Infinity || maxBlock === 0) return null;

    return { min: minBlock, max: maxBlock };
  }
}
