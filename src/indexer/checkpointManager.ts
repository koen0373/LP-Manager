/**
 * Checkpoint Manager
 * 
 * Manages sync checkpoints for resumable indexing
 */

import { PrismaClient } from '@prisma/client';

export interface Checkpoint {
  source: string;
  key: string;
  lastBlock: number;
  lastTimestamp?: number;
  eventsCount: number;
}

export class CheckpointManager {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get checkpoint for a specific source + key
   */
  async get(source: string, key: string): Promise<Checkpoint | null> {
    const id = `${source}:${key}`;
    const checkpoint = await this.prisma.syncCheckpoint.findUnique({
      where: { id },
    });

    if (!checkpoint) return null;

    return {
      source: checkpoint.source,
      key: checkpoint.key,
      lastBlock: checkpoint.lastBlock,
      lastTimestamp: checkpoint.lastTimestamp ?? undefined,
      eventsCount: checkpoint.eventsCount,
    };
  }

  /**
   * Upsert checkpoint (create or update)
   */
  async upsert(checkpoint: Checkpoint): Promise<void> {
    const id = `${checkpoint.source}:${checkpoint.key}`;

    await this.prisma.syncCheckpoint.upsert({
      where: { id },
      create: {
        id,
        source: checkpoint.source,
        key: checkpoint.key,
        lastBlock: checkpoint.lastBlock,
        lastTimestamp: checkpoint.lastTimestamp,
        eventsCount: checkpoint.eventsCount,
      },
      update: {
        lastBlock: checkpoint.lastBlock,
        lastTimestamp: checkpoint.lastTimestamp,
        eventsCount: checkpoint.eventsCount,
      },
    });
  }

  /**
   * Increment events count for a checkpoint
   */
  async incrementEventsCount(source: string, key: string, count: number): Promise<void> {
    const id = `${source}:${key}`;

    await this.prisma.syncCheckpoint.update({
      where: { id },
      data: {
        eventsCount: {
          increment: count,
        },
      },
    });
  }

  /**
   * Get all checkpoints for a source
   */
  async getAll(source: string): Promise<Checkpoint[]> {
    const checkpoints = await this.prisma.syncCheckpoint.findMany({
      where: { source },
      orderBy: { lastBlock: 'desc' },
    });

    return checkpoints.map((cp) => ({
      source: cp.source,
      key: cp.key,
      lastBlock: cp.lastBlock,
      lastTimestamp: cp.lastTimestamp ?? undefined,
      eventsCount: cp.eventsCount,
    }));
  }

  /**
   * Delete a checkpoint
   */
  async delete(source: string, key: string): Promise<void> {
    const id = `${source}:${key}`;
    await this.prisma.syncCheckpoint.delete({
      where: { id },
    });
  }
}

