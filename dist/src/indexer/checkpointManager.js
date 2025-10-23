"use strict";
/**
 * Checkpoint Manager
 *
 * Manages sync checkpoints for resumable indexing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckpointManager = void 0;
class CheckpointManager {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Get checkpoint for a specific source + key
     */
    async get(source, key) {
        const id = `${source}:${key}`;
        const checkpoint = await this.prisma.syncCheckpoint.findUnique({
            where: { id },
        });
        if (!checkpoint)
            return null;
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
    async upsert(checkpoint) {
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
    async incrementEventsCount(source, key, count) {
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
    async getAll(source) {
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
    async delete(source, key) {
        const id = `${source}:${key}`;
        await this.prisma.syncCheckpoint.delete({
            where: { id },
        });
    }
}
exports.CheckpointManager = CheckpointManager;
