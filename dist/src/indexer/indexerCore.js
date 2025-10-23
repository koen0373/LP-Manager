"use strict";
/**
 * Indexer Core
 *
 * Main orchestrator that coordinates RPC scanning, decoding, and database writes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexerCore = void 0;
const client_1 = require("@prisma/client");
const rpcScanner_1 = require("./rpcScanner");
const eventDecoder_1 = require("./eventDecoder");
const dbWriter_1 = require("./dbWriter");
const checkpointManager_1 = require("./checkpointManager");
const indexer_config_1 = require("../../indexer.config");
class IndexerCore {
    constructor() {
        this.prisma = new client_1.PrismaClient();
        this.scanner = new rpcScanner_1.RpcScanner();
        this.decoder = new eventDecoder_1.EventDecoder();
        this.writer = new dbWriter_1.DbWriter(this.prisma);
        this.checkpoints = new checkpointManager_1.CheckpointManager(this.prisma);
    }
    /**
     * Index a block range
     */
    async index(options) {
        const startTime = Date.now();
        const { dryRun = false, checkpointKey = 'global', tokenIds } = options;
        // Determine block range
        let fromBlock = options.fromBlock;
        let toBlock = options.toBlock;
        // Load checkpoint if fromBlock not specified
        if (!fromBlock) {
            const checkpoint = await this.checkpoints.get('NPM', checkpointKey);
            fromBlock = checkpoint ? checkpoint.lastBlock + 1 : indexer_config_1.indexerConfig.contracts.startBlock;
        }
        // Get latest block if toBlock not specified
        if (!toBlock) {
            toBlock = await this.scanner.getLatestBlock();
            // Apply confirmation blocks buffer
            toBlock -= indexer_config_1.indexerConfig.follower.confirmationBlocks;
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
            contractAddress: indexer_config_1.indexerConfig.contracts.npm,
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
            console.log(`[INDEXER] ✓ Written ${writeStats.transfersWritten + writeStats.eventsWritten} events (${writeStats.duplicates} duplicates, ${writeStats.errors} errors)`);
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
        console.log(`[INDEXER] ✨ Complete: ${toBlock - fromBlock + 1} blocks, ${decodedEvents.length} events (${blocksPerSec} blocks/s)`);
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
    async getStatus(checkpointKey = 'global') {
        const checkpoint = await this.checkpoints.get('NPM', checkpointKey);
        const latestBlock = await this.scanner.getLatestBlock();
        const checkpointBlock = checkpoint?.lastBlock ?? null;
        const blocksBehind = checkpointBlock ? latestBlock - checkpointBlock : latestBlock - indexer_config_1.indexerConfig.contracts.startBlock;
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
    async close() {
        await this.prisma.$disconnect();
    }
}
exports.IndexerCore = IndexerCore;
