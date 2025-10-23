// Backfill cursor management for checkpointing

import { db } from '../data/db';

/**
 * Get or initialize backfill cursor for a tokenId
 */
export async function getOrInitCursor(tokenId: number): Promise<{
  tokenId: number;
  lastBlock: number;
  lastFetchedAt: Date;
}> {
  const cursor = await db.backfillCursor.findUnique({
    where: { tokenId },
  });

  if (cursor) {
    return cursor;
  }

  // Initialize new cursor starting from block 0
  const newCursor = await db.backfillCursor.create({
    data: {
      tokenId,
      lastBlock: 0,
      lastFetchedAt: new Date(),
    },
  });

  return newCursor;
}

/**
 * Update cursor after successful backfill batch
 */
export async function updateCursor(
  tokenId: number,
  lastBlock: number
): Promise<void> {
  await db.backfillCursor.upsert({
    where: { tokenId },
    update: {
      lastBlock,
      lastFetchedAt: new Date(),
    },
    create: {
      tokenId,
      lastBlock,
      lastFetchedAt: new Date(),
    },
  });
}

/**
 * Reset cursor for a tokenId (useful for re-sync)
 */
export async function resetCursor(tokenId: number): Promise<void> {
  await db.backfillCursor.upsert({
    where: { tokenId },
    update: {
      lastBlock: 0,
      lastFetchedAt: new Date(),
    },
    create: {
      tokenId,
      lastBlock: 0,
      lastFetchedAt: new Date(),
    },
  });
}

