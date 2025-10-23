/**
 * Indexer Core
 * 
 * Main orchestrator that coordinates RPC scanning, decoding, and database writes
 */

import { PrismaClient } from '@prisma/client';
import { RpcScanner } from './rpcScanner';
import { EventDecoder } from './eventDecoder';
import { DbWriter } from './dbWriter';
import { CheckpointManager } from './checkpointManager';
import { indexerConfig } from '../../indexer.config';

export interface IndexOptions {
  fromBlock?: number;
  toBlock?: number;
  tokenIds?: string[];
  dryRun?: boolean;
  checkpointKey?: string; // "global" or "tokenId:12345"
}

export interface IndexResult {
  blocksScanned: number;
  logsFound: number;
  eventsDecoded: number;
  eventsWritten: number;
  duplicates: number;
  errors: number;
  elapsedMs: number;
  checkpointSaved: boolean;
}

export class IndexerCore {
  private scanner: RpcScanner;
  private decoder: EventDecoder;
  private writer: DbWriter;
  private checkpoints: CheckpointManager;
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
    this.scanner = new RpcScanner();
    this.decoder = new EventDecoder();
    this.writer = new DbWriter(this.prisma);
    this.checkpoints = new CheckpointManager(this.prisma);
  }

  /**
   * Index a block range
   */
  async index(options: IndexOptions): Promise<IndexResult> {
    const startTime = Date.now();
    const { dryRun = false, checkpointKey = 'global', tokenIds } = options;

    // Determine block range
    let fromBlock = options.fromBlock;
    let toBlock = options.toBlock;

    // Load checkpoint if fromBlock not specified
    if (!fromBlock) {
      const checkpoint = await this.checkpoints.get('NPM', checkpointKey);
      fromBlock = checkpoint ? checkpoint.lastBlock + 1 : indexerConfig.contracts.startBlock;
    }

    // Get latest block if toBlock not specified
    if (!toBlock) {
      toBlock = await this.scanner.getLatestBlock();
      // Apply confirmation blocks buffer
      toBlock -= indexerConfig.follower.confirmationBlocks;
    }

    if (fromBlock > toBlock) {
      console.log(`[INDEXER] ℹ No new blocks to sync (checkpoint at ${fromBlock}, latest at ${toBlock})`);
      return {
        blocksScanned: 0,
        logsFound: 0,
        eventsDecoded: 0,
        eventsWritten: 0,
        duplicates: 0,
        errors: 0,
        elapsedMs: Date.now() - startTime,
        checkpointSaved: false,
      };
    }

    console.log(`[INDEXER] 🚀 Starting sync: ${fromBlock} → ${toBlock} (${toBlock - fromBlock + 1} blocks)`);
    if (tokenIds && tokenIds.length > 0) {
      console.log(`[INDEXER] 🎯 Filtering for tokenIds: ${tokenIds.join(', ')}`);
    }

    // Scan blockchain for logs
    const scanResult = await this.scanner.scan({
      fromBlock,
      toBlock,
      contractAddress: indexerConfig.contracts.npm,
      tokenIds,
      dryRun,
    });

    // Decode events
    const decodedEvents = this.decoder.decodeBatch(scanResult.logs);
    console.log(`[INDEXER] ✓ Decoded ${decodedEvents.length}/${scanResult.logs.length} events`);

    let writeStats = {
      transfersWritten: 0,
      eventsWritten: 0,
      duplicates: 0,
      errors: 0,
    };

    // Write to database (unless dry run)
    if (!dryRun && decodedEvents.length > 0) {
      // Get block timestamp for the middle of the range (approximation)
      const midBlock = Math.floor((fromBlock + toBlock) / 2);
      const timestamp = await this.scanner.getBlockTimestamp(midBlock);

      writeStats = await this.writer.write(decodedEvents, timestamp);
      console.log(
        `[INDEXER] ✓ Written ${writeStats.transfersWritten + writeStats.eventsWritten} events (${writeStats.duplicates} duplicates, ${writeStats.errors} errors)`
      );
    }

    // Save checkpoint
    let checkpointSaved = false;
    if (!dryRun) {
      await this.checkpoints.upsert({
        source: 'NPM',
        key: checkpointKey,
        lastBlock: toBlock,
        eventsCount: writeStats.transfersWritten + writeStats.eventsWritten,
      });
      checkpointSaved = true;
      console.log(`[INDEXER] ✓ Checkpoint saved: NPM:${checkpointKey} @ block ${toBlock}`);
    }

    const elapsedMs = Date.now() - startTime;
    const blocksPerSec = Math.round((toBlock - fromBlock + 1) / (elapsedMs / 1000));

    console.log(
      `[INDEXER] ✨ Complete: ${toBlock - fromBlock + 1} blocks, ${decodedEvents.length} events (${blocksPerSec} blocks/s)`
    );

    return {
      blocksScanned: toBlock - fromBlock + 1,
      logsFound: scanResult.logs.length,
      eventsDecoded: decodedEvents.length,
      eventsWritten: writeStats.transfersWritten + writeStats.eventsWritten,
      duplicates: writeStats.duplicates,
      errors: writeStats.errors,
      elapsedMs,
      checkpointSaved,
    };
  }

  /**
   * Get current sync status
   */
  async getStatus(checkpointKey = 'global'): Promise<{
    checkpoint: number | null;
    latestBlock: number;
    blocksBehind: number;
    eventsCount: number;
  }> {
    const checkpoint = await this.checkpoints.get('NPM', checkpointKey);
    const latestBlock = await this.scanner.getLatestBlock();
    const checkpointBlock = checkpoint?.lastBlock ?? null;
    const blocksBehind = checkpointBlock ? latestBlock - checkpointBlock : latestBlock - indexerConfig.contracts.startBlock;

    return {
      checkpoint: checkpointBlock,
      latestBlock,
      blocksBehind,
      eventsCount: checkpoint?.eventsCount ?? 0,
    };
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

