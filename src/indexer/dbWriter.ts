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
            },
            update: {}, // No-op on duplicate
          })
        )
      );

      written = transfers.length;
    } catch (error: any) {
      // Handle unique constraint violations
      if (error.code === 'P2002') {
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
    } catch (error: any) {
      // Handle unique constraint violations
      if (error.code === 'P2002') {
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

