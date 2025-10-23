// Core backfill worker logic

import pLimit from 'p-limit';
import { getOrInitCursor, updateCursor } from './cursor';
import { fetchPositionTransfers, getCurrentBlockNumber } from './fetcher';
import { persistTransfers, type TransferToPersist } from './persist';
import { syncPositionLedger } from '../sync/syncPositionLedger';
import type { BackfillOptions, BackfillResult, BackfillSummary } from './types';

const DEFAULT_CONCURRENCY = 6;
const POSITIONS_ADDRESS = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657';

/**
 * Backfill a single position
 */
async function backfillSinglePosition(
  tokenId: number,
  mode: 'full' | 'since' = 'since',
  sinceBlock?: number
): Promise<BackfillResult> {
  const startTime = Date.now();
  console.log(`[BACKFILL:${tokenId}] Starting backfill (mode: ${mode})`);

  try {
    // Get or initialize cursor
    const cursor = await getOrInitCursor(tokenId);
    const fromBlock = mode === 'full' ? 0 : (sinceBlock || cursor.lastBlock);
    
    console.log(`[BACKFILL:${tokenId}] Resuming from block ${fromBlock}`);

    // Use existing syncPositionLedger for comprehensive sync
    // This already handles events, transfers, and proper deduplication
    await syncPositionLedger(String(tokenId));

    // Fetch transfers for completeness
    let page = 1;
    let hasMore = true;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    while (hasMore) {
      const transfers = await fetchPositionTransfers(tokenId, POSITIONS_ADDRESS, page, 100);
      
      if (transfers.length === 0) {
        hasMore = false;
        break;
      }

      // Convert to persist format
      const transfersToPersist: TransferToPersist[] = transfers.map(t => ({
        tokenId: String(tokenId),
        from: t.from.hash.toLowerCase(),
        to: t.to.hash.toLowerCase(),
        blockNumber: t.block_number,
        txHash: t.transaction_hash,
        logIndex: t.log_index,
        timestamp: Math.floor(new Date(t.timestamp).getTime() / 1000),
      }));

      // Persist transfers
      const result = await persistTransfers(transfersToPersist);
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;

      console.log(
        `[BACKFILL:${tokenId}] Page ${page}: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped`
      );

      if (transfers.length < 100) {
        hasMore = false;
      }
      page++;
    }

    // Update cursor to current block
    const currentBlock = await getCurrentBlockNumber();
    await updateCursor(tokenId, currentBlock);

    const elapsedMs = Date.now() - startTime;
    console.log(
      `[BACKFILL:${tokenId}] ✅ Complete in ${elapsedMs}ms: ${totalInserted} inserted, ${totalUpdated} updated, ${totalSkipped} skipped`
    );

    return {
      tokenId,
      success: true,
      inserted: totalInserted,
      updated: totalUpdated,
      skipped: totalSkipped,
      lastBlock: currentBlock,
      elapsedMs,
    };
  } catch (error: unknown) {
    const err = error as Error;
    const elapsedMs = Date.now() - startTime;
    console.error(`[BACKFILL:${tokenId}] ❌ Failed after ${elapsedMs}ms:`, err.message);

    return {
      tokenId,
      success: false,
      inserted: 0,
      updated: 0,
      skipped: 0,
      lastBlock: 0,
      elapsedMs,
      error: err.message || 'Unknown error',
    };
  }
}

/**
 * Backfill multiple positions with concurrency control
 */
export async function backfillPositions(
  options: BackfillOptions = {}
): Promise<BackfillSummary> {
  const {
    tokenIds = [],
    mode = 'since',
    sinceBlock,
    concurrency = DEFAULT_CONCURRENCY,
  } = options;

  if (tokenIds.length === 0) {
    throw new Error('No tokenIds provided for backfill');
  }

  console.log(`[BACKFILL] Starting batch backfill for ${tokenIds.length} positions (concurrency: ${concurrency})`);
  const startTime = Date.now();

  // Create concurrency limiter
  const limit = pLimit(concurrency);

  // Run backfills with concurrency control
  const results = await Promise.all(
    tokenIds.map(tokenId =>
      limit(() => backfillSinglePosition(tokenId, mode, sinceBlock))
    )
  );

  // Aggregate results
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
  const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
  const totalElapsedMs = Date.now() - startTime;

  const summary: BackfillSummary = {
    total: tokenIds.length,
    successful,
    failed,
    totalInserted,
    totalUpdated,
    totalSkipped,
    totalElapsedMs,
    results,
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 BACKFILL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total positions: ${summary.total}`);
  console.log(`✅ Successful: ${summary.successful}`);
  console.log(`❌ Failed: ${summary.failed}`);
  console.log(`📝 Total inserted: ${summary.totalInserted}`);
  console.log(`🔄 Total updated: ${summary.totalUpdated}`);
  console.log(`⏭️  Total skipped: ${summary.totalSkipped}`);
  console.log(`⏱️  Total elapsed: ${(summary.totalElapsedMs / 1000).toFixed(2)}s`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n❌ Failed positions:');
    results
      .filter(r => !r.success)
      .forEach(r => console.log(`  - Position ${r.tokenId}: ${r.error}`));
  }

  return summary;
}

