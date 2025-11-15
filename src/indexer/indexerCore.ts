/**
 * Indexer Core
 * 
 * Main orchestrator that coordinates RPC scanning, decoding, and database writes
 */

import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import type { Log } from 'viem';
import { RpcScanner } from './rpcScanner';
import { EventDecoder } from './eventDecoder';
import { DbWriter, type PoolEventRow } from './dbWriter';
import { CheckpointManager } from './checkpointManager';
import { indexerConfig } from '../../indexer.config';
import { FactoryScanner } from './factoryScanner';
import { PoolScanner, type PoolScanResult } from './poolScanner';
import { PoolRegistry } from './poolRegistry';
import { normalizeScanResult } from '@/lib/indexer/scan';

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
  private factoryScanner: FactoryScanner;
  private poolScanner: PoolScanner;
  private poolRegistry: PoolRegistry;
  private factoryStartBlocks?: Record<string, number>;

  constructor() {
    this.prisma = new PrismaClient();
    this.scanner = new RpcScanner();
    this.decoder = new EventDecoder();
    this.writer = new DbWriter(this.prisma);
    this.checkpoints = new CheckpointManager(this.prisma);
    this.factoryScanner = new FactoryScanner(this.scanner);
    this.poolScanner = new PoolScanner(this.scanner);
    this.poolRegistry = new PoolRegistry(this.prisma);
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

    // Normalize npm config to array
    const npmAddresses = Array.isArray(indexerConfig.contracts.npm) 
      ? indexerConfig.contracts.npm 
      : [indexerConfig.contracts.npm];

    console.log(`[INDEXER] 📍 Scanning ${npmAddresses.length} NFPM contract(s): ${npmAddresses.join(', ')}`);

    // Scan all NFPM contracts
    let allLogs: Log[] = [];
    let totalLogsFound = 0;
    for (const npmAddress of npmAddresses) {
      let chunkEvents: Log[] = [];
      let chunkNextFrom = fromBlock;
      try {
        const raw = await this.scanner.scan({
          fromBlock,
          toBlock,
          contractAddress: npmAddress,
          tokenIds,
          dryRun,
        });
        const normalized = normalizeScanResult<Log>(
          { events: raw.logs as Log[], nextFrom: (raw as any)?.nextFrom ?? null },
          fromBlock,
        );
        chunkEvents = normalized.events;
        chunkNextFrom = normalized.nextFrom ?? fromBlock;
      } catch (error) {
        console.error(`[INDEXER] scan failed for ${npmAddress}`, error);
        const fallback = normalizeScanResult<Log>(undefined, fromBlock);
        chunkEvents = fallback.events;
        chunkNextFrom = fallback.nextFrom ?? fromBlock;
      }
      console.log(
        `[INDEXER] ✓ Found ${chunkEvents.length} logs from ${npmAddress} (nextFrom=${chunkNextFrom})`
      );
      totalLogsFound += chunkEvents.length;
      allLogs = allLogs.concat(chunkEvents);
    }

    console.log(`[INDEXER] ✓ Total logs found: ${allLogs.length}`);

    // Decode events
    const decodedEvents = this.decoder.decodeBatch(allLogs);
    console.log(`[INDEXER] ✓ Decoded ${decodedEvents.length}/${allLogs.length} events`);

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
      logsFound: totalLogsFound,
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
   * Get ANKR cost summary from scanner
   */
  getCostSummary() {
    return this.scanner.getCostSummary();
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async indexFactories(options: {
    factory: 'enosys' | 'sparkdex';
    fromBlock?: number;
    toBlock?: number;
    dryRun?: boolean;
    checkpointKey?: string;
  }): Promise<IndexResult> {
    const startTime = Date.now();
    const { factory, dryRun = false } = options;
    const checkpointKey = options.checkpointKey ?? factory;
    const confirmations = indexerConfig.follower.confirmationBlocks;

    const checkpoint = await this.checkpoints.get('FACTORY', checkpointKey);

    let fromBlock = options.fromBlock;
    if (checkpoint) {
      if (fromBlock === undefined || fromBlock <= checkpoint.lastBlock) {
        fromBlock = checkpoint.lastBlock + 1;
      }
    }

    if (!fromBlock) {
      const startBlocks = await this.loadFactoryStartBlocks();
      fromBlock = startBlocks[factory] ?? indexerConfig.contracts.startBlock;
    }

    let toBlock = options.toBlock;
    if (!toBlock) {
      toBlock = await this.scanner.getLatestBlock();
    }
    toBlock -= confirmations;

    if (fromBlock > toBlock) {
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

    const factoryAddress = indexerConfig.contracts.factories?.[factory];
    if (!factoryAddress) {
      throw new Error(`No factory address configured for ${factory}`);
    }

    const scanResult = await this.factoryScanner.scan({
      fromBlock,
      toBlock,
      factoryAddress,
    });

    const rows: PoolEventRow[] = scanResult.events.map((event) => ({
      id: `${event.txHash}:${event.logIndex}`,
      pool: event.pool,
      blockNumber: event.blockNumber,
      txHash: event.txHash,
      logIndex: event.logIndex,
      timestamp: event.timestamp,
      eventName: event.eventName,
      sender: null,
      owner: null,
      recipient: null,
      tickLower: null,
      tickUpper: null,
      amount: null,
      amount0: null,
      amount1: null,
      sqrtPriceX96: null,
      liquidity: null,
      tick: null,
    }));

    let writeStats = { written: 0, duplicates: 0, errors: 0 };

    if (!dryRun && rows.length > 0) {
      writeStats = await this.writer.writePoolEvents(rows);
    }

    if (!dryRun) {
      await this.checkpoints.upsert({
        source: 'FACTORY',
        key: checkpointKey,
        lastBlock: toBlock,
        eventsCount: writeStats.written,
      });
    }

    const elapsedMs = Date.now() - startTime;

    return {
      blocksScanned: toBlock - fromBlock + 1,
      logsFound: scanResult.logsFound,
      eventsDecoded: scanResult.events.length,
      eventsWritten: dryRun ? 0 : writeStats.written,
      duplicates: writeStats.duplicates,
      errors: writeStats.errors,
      elapsedMs,
      checkpointSaved: !dryRun,
    };
  }

  async indexPoolEvents(options: {
    checkpointKey?: string;
    fromBlock?: number;
    toBlock?: number;
    dryRun?: boolean;
  }): Promise<IndexResult> {
    const startTime = Date.now();
    const { dryRun = false } = options;
    const checkpointKey = options.checkpointKey ?? 'all';
    const confirmations = indexerConfig.follower.confirmationBlocks;

    const pools = await this.poolRegistry.getPools();
    if (pools.length === 0) {
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

    const checkpoint = await this.checkpoints.get('POOLS', checkpointKey);

    let fromBlock = options.fromBlock;
    if (checkpoint) {
      if (fromBlock === undefined || fromBlock <= checkpoint.lastBlock) {
        fromBlock = checkpoint.lastBlock + 1;
      }
    }

    if (!fromBlock) {
      const minBlock = await this.poolRegistry.getMinCreatedBlock();
      fromBlock = minBlock ?? indexerConfig.contracts.startBlock;
    }

    let toBlock = options.toBlock;
    if (!toBlock) {
      toBlock = await this.scanner.getLatestBlock();
    }
    toBlock -= confirmations;

    if (fromBlock > toBlock) {
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

    console.log(
      JSON.stringify({
        mode: 'pools',
        fromBlock,
        toBlock,
        poolCount: pools.length,
        chosenChunk: indexerConfig.rpc.batchSize,
      })
    );

    let scanResult: PoolScanResult;
    try {
      scanResult = await this.poolScanner.scan({
        fromBlock,
        toBlock,
        pools,
      });
    } catch (error) {
      console.error('[INDEXER] pool scan failed', error);
      scanResult = {
        rows: [],
        logsFound: 0,
        scannedBlocks: toBlock - fromBlock + 1,
        elapsedMs: 0,
      };
    }

    let writeStats = { written: 0, duplicates: 0, errors: 0 };

    if (!dryRun && scanResult.rows.length > 0) {
      writeStats = await this.writer.writePoolEvents(scanResult.rows);
    }

    if (!dryRun) {
      await this.checkpoints.upsert({
        source: 'POOLS',
        key: checkpointKey,
        lastBlock: toBlock,
        eventsCount: writeStats.written,
      });
    }

    return {
      blocksScanned: scanResult.scannedBlocks,
      logsFound: scanResult.logsFound,
      eventsDecoded: scanResult.rows.length,
      eventsWritten: dryRun ? 0 : writeStats.written,
      duplicates: dryRun ? 0 : writeStats.duplicates,
      errors: dryRun ? 0 : writeStats.errors,
      elapsedMs: Date.now() - startTime,
      checkpointSaved: !dryRun,
    };
  }

  async getKnownPools(): Promise<string[]> {
    return this.poolRegistry.getPools();
  }

  async getPoolCheckpoint(key = 'all') {
    return this.checkpoints.get('POOLS', key);
  }

  private async loadFactoryStartBlocks(): Promise<Record<string, number>> {
    if (this.factoryStartBlocks) {
      return this.factoryStartBlocks;
    }

    const startBlocksPath = path.join(process.cwd(), 'data/config/startBlocks.json');

    try {
      const raw = await fs.readFile(startBlocksPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.factoryStartBlocks = parsed as Record<string, number>;
        return this.factoryStartBlocks;
      }
    } catch (error: any) {
      if (!error || error.code !== 'ENOENT') {
        console.warn('[IndexerCore] Unable to load startBlocks.json:', error);
      }
    }

    this.factoryStartBlocks = {};
    return this.factoryStartBlocks;
  }
}
