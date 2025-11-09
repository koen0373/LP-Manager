/**
 * Staking Event Scanner
 * 
 * Scans staking contracts (MasterChef, Gauge, etc.) for:
 * - Deposit/Stake events
 * - Withdraw/Unstake events  
 * - Reward events
 * 
 * Usage:
 *   const scanner = new StakingScanner(rpcUrl, config);
 *   const events = await scanner.scan(fromBlock, toBlock);
 */

import { createPublicClient, http, type Log, decodeEventLog } from 'viem';
import { flare } from 'viem/chains';
import type { StakingContractConfig } from './config/stakingContracts';
import { STAKING_EVENTS_ABI, GAUGE_EVENTS_ABI } from './abis/staking';

export interface StakingEventRow {
  id: string;                // txHash:logIndex
  stakingContract: string;
  poolAddress: string | null;
  eventName: string;
  userAddress: string | null;
  rewardToken: string | null;
  amount: string | null;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  timestamp: number;
  metadata: Record<string, any>;
}

export class StakingScanner {
  private client;
  private config: StakingContractConfig;

  constructor(rpcUrl: string, config: StakingContractConfig) {
    this.client = createPublicClient({
      chain: flare,
      transport: http(rpcUrl),
    });
    this.config = config;
  }

  /**
   * Scan for staking events in block range
   */
  async scan(fromBlock: number, toBlock: number): Promise<StakingEventRow[]> {
    const abi = this.config.type === 'gauge' ? GAUGE_EVENTS_ABI : STAKING_EVENTS_ABI;

    console.log(
      `[StakingScanner] Scanning ${this.config.address} (${this.config.dex}) blocks ${fromBlock}→${toBlock}`
    );

    // Fetch logs
    const logs = await this.client.getLogs({
      address: this.config.address as `0x${string}`,
      events: abi,
      fromBlock: BigInt(fromBlock),
      toBlock: BigInt(toBlock),
    });

    console.log(`[StakingScanner] Found ${logs.length} events`);

    // Decode & transform
    const events: StakingEventRow[] = [];

    for (const log of logs) {
      try {
        const decoded = this.decodeLog(log, abi);
        if (decoded) {
          events.push(decoded);
        }
      } catch (err) {
        console.warn(`[StakingScanner] Failed to decode log:`, log, err);
      }
    }

    // Fetch timestamps (batch)
    await this.enrichWithTimestamps(events);

    return events;
  }

  /**
   * Decode a single log
   */
  private decodeLog(log: Log, abi: readonly any[]): StakingEventRow | null {
    try {
      const decoded = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics,
      });

      const eventName = decoded.eventName as string;
      const args = decoded.args as Record<string, any>;

      // Extract common fields
      const userAddress = args.user?.toLowerCase() || args.staker?.toLowerCase() || null;
      const amount = args.amount ? String(args.amount) : null;
      const rewardToken = args.rewardsToken?.toLowerCase() || this.config.rewardToken.toLowerCase();

      // Try to resolve pool address
      const poolAddress = this.resolvePoolAddress(eventName, args);

      return {
        id: `${log.transactionHash}:${log.logIndex}`,
        stakingContract: this.config.address.toLowerCase(),
        poolAddress,
        eventName,
        userAddress,
        rewardToken,
        amount,
        blockNumber: Number(log.blockNumber),
        txHash: log.transactionHash!,
        logIndex: Number(log.logIndex),
        timestamp: 0, // Enriched later
        metadata: {
          pid: args.pid ? Number(args.pid) : undefined,
          dex: this.config.dex,
          ...args,
        },
      };
    } catch (err) {
      console.warn(`[StakingScanner] Decode error:`, err);
      return null;
    }
  }

  /**
   * Resolve pool address from event args
   */
  private resolvePoolAddress(eventName: string, args: Record<string, any>): string | null {
    // MasterChef: use PID mapping
    if (this.config.type === 'masterchef' && 'pid' in args) {
      const pid = String(args.pid);
      return this.config.poolMapping?.[pid] || null;
    }

    // Gauge: requires on-chain read (implement later)
    if (this.config.type === 'gauge') {
      // TODO: Read gauge.stakingToken() to get LP token address
      return null;
    }

    return null;
  }

  /**
   * Enrich events with block timestamps
   */
  private async enrichWithTimestamps(events: StakingEventRow[]): Promise<void> {
    const uniqueBlocks = [...new Set(events.map((e) => e.blockNumber))];
    const blockCache = new Map<number, number>();

    // Fetch blocks in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < uniqueBlocks.length; i += BATCH_SIZE) {
      const batch = uniqueBlocks.slice(i, i + BATCH_SIZE);
      const blocks = await Promise.all(
        batch.map((bn) =>
          this.client.getBlock({ blockNumber: BigInt(bn) }).catch(() => null)
        )
      );

      blocks.forEach((block, idx) => {
        if (block) {
          blockCache.set(batch[idx], Number(block.timestamp));
        }
      });
    }

    // Apply timestamps
    for (const event of events) {
      event.timestamp = blockCache.get(event.blockNumber) || 0;
    }
  }
}

