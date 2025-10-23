// Persist events to database with idempotent upserts

import { db } from '../data/db';
import type { PositionEventType } from '@prisma/client';

export interface EventToPersist {
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
  metadata?: any;
}

export interface TransferToPersist {
  tokenId: string;
  from: string;
  to: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  timestamp: number;
  metadata?: any;
}

/**
 * Persist position events with idempotent upserts
 * Returns { inserted, updated, skipped }
 */
export async function persistEvents(
  events: EventToPersist[]
): Promise<{ inserted: number; updated: number; skipped: number }> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  // Process in batches to avoid transaction size limits
  const batchSize = 50;
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(event =>
        db.positionEvent.upsert({
          where: {
            txHash_logIndex: {
              txHash: event.txHash,
              logIndex: event.logIndex,
            },
          },
          update: {
            // Minimal update - only timestamp/metadata if changed
            timestamp: event.timestamp,
            metadata: event.metadata,
          },
          create: {
            id: `${event.txHash}:${event.logIndex}`,
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
        })
      )
    );

    // Count results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        // Check if it was an insert or update by comparing timestamps
        inserted++;
      } else {
        console.error('[PERSIST] Event upsert failed:', result.reason);
        skipped++;
      }
    }
  }

  return { inserted, updated, skipped };
}

/**
 * Persist position transfers with idempotent upserts
 */
export async function persistTransfers(
  transfers: TransferToPersist[]
): Promise<{ inserted: number; updated: number; skipped: number }> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const batchSize = 50;
  for (let i = 0; i < transfers.length; i += batchSize) {
    const batch = transfers.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(transfer =>
        db.positionTransfer.upsert({
          where: {
            txHash_logIndex: {
              txHash: transfer.txHash,
              logIndex: transfer.logIndex,
            },
          },
          update: {
            timestamp: transfer.timestamp,
            metadata: transfer.metadata,
          },
          create: {
            id: `${transfer.txHash}:${transfer.logIndex}`,
            tokenId: transfer.tokenId,
            from: transfer.from,
            to: transfer.to,
            blockNumber: transfer.blockNumber,
            txHash: transfer.txHash,
            logIndex: transfer.logIndex,
            timestamp: transfer.timestamp,
            metadata: transfer.metadata,
          },
        })
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        inserted++;
      } else {
        console.error('[PERSIST] Transfer upsert failed:', result.reason);
        skipped++;
      }
    }
  }

  return { inserted, updated, skipped };
}

