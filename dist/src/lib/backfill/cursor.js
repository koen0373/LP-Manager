"use strict";
// Backfill cursor management for checkpointing
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrInitCursor = getOrInitCursor;
exports.updateCursor = updateCursor;
exports.resetCursor = resetCursor;
const db_1 = require("../data/db");
/**
 * Get or initialize backfill cursor for a tokenId
 */
async function getOrInitCursor(tokenId) {
    const cursor = await db_1.db.backfillCursor.findUnique({
        where: { tokenId },
    });
    if (cursor) {
        return cursor;
    }
    // Initialize new cursor starting from block 0
    const newCursor = await db_1.db.backfillCursor.create({
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
async function updateCursor(tokenId, lastBlock) {
    await db_1.db.backfillCursor.upsert({
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
async function resetCursor(tokenId) {
    await db_1.db.backfillCursor.upsert({
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
