// Sync pool-level Swap events for price history
import { publicClient } from '@/lib/viemClient';
import { decodeEventLog, Hex } from 'viem';
import { UNISWAP_V3_POOL_ABI } from '@/abis/UniswapV3Pool';
import { db } from '@/store/prisma';

interface SyncSwapsOptions {
  fromBlock?: number;
  toBlock?: number;
  verbose?: boolean;
}

export async function syncPoolSwaps(
  poolAddress: string,
  options: SyncSwapsOptions = {}
): Promise<{
  success: boolean;
  swapsIngested: number;
  error?: string;
}> {
  const { fromBlock, toBlock, verbose = false } = options;

  try {
    if (verbose) {
      console.log(`[SWAP_SYNC] Starting swap sync for pool ${poolAddress}`);
    }

    // Get latest block if not specified
    const latestBlock = toBlock || await publicClient.getBlockNumber();
    const startBlock = fromBlock || Number(latestBlock) - 50000; // Last ~50k blocks

    if (verbose) {
      console.log(`[SWAP_SYNC] Fetching swaps from block ${startBlock} to ${latestBlock}`);
    }

    // Fetch Swap events from pool in chunks (RPC limit is 30 blocks)
    // Swap event signature: Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)
    const SWAP_TOPIC: Hex = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
    
    const allLogs: Array<{
      address: Hex;
      blockHash: Hex;
      blockNumber: bigint;
      data: Hex;
      logIndex: number | null;
      removed: boolean;
      topics: [Hex, ...Hex[]];
      transactionHash: Hex;
      transactionIndex: number;
    }> = [];
    const chunkSize = 25; // RPC limit is 30, use 25 to be safe
    
    for (let fromChunk = startBlock; fromChunk < latestBlock; fromChunk += chunkSize) {
      const toChunk = Math.min(fromChunk + chunkSize - 1, Number(latestBlock));
      
      if (verbose && fromChunk % 1000 === startBlock % 1000) {
        console.log(`[SWAP_SYNC] Fetching blocks ${fromChunk} to ${toChunk}`);
      }
      
      try {
        const logs = await publicClient.getLogs({
          address: poolAddress as Hex,
          event: {
            type: 'event',
            name: 'Swap',
            inputs: [],
          },
          fromBlock: BigInt(fromChunk),
          toBlock: BigInt(toChunk),
        });
        
        allLogs.push(...logs);
        
        if (verbose && logs.length > 0) {
          console.log(`[SWAP_SYNC] Found ${logs.length} swaps in chunk`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        if (verbose) {
          console.warn(`[SWAP_SYNC] Error fetching chunk ${fromChunk}-${toChunk}:`, error);
        }
      }
    }

    if (verbose) {
      console.log(`[SWAP_SYNC] Found ${allLogs.length} total swap logs`);
    }

    let swapsProcessed = 0;
    const logs = allLogs;

    // Process in chunks of 100
    const processChunkSize = 100;
    for (let i = 0; i < logs.length; i += processChunkSize) {
      const chunk = logs.slice(i, i + processChunkSize);
      
      for (const log of chunk) {
        try {
          const decoded = decodeEventLog({
            abi: UNISWAP_V3_POOL_ABI,
            data: log.data,
            topics: log.topics,
          });

          if (decoded.eventName !== 'Swap') continue;

          const args = decoded.args as Record<string, unknown>;
          
          // Get block timestamp
          const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
          
          // Upsert to PoolEvent table
          await db.poolEvent.upsert({
            where: {
              txHash_logIndex: {
                txHash: log.transactionHash,
                logIndex: Number(log.logIndex || 0),
              },
            },
            update: {},
            create: {
              id: `${log.transactionHash}:${log.logIndex || 0}`,
              pool: poolAddress.toLowerCase(),
              blockNumber: Number(log.blockNumber),
              txHash: log.transactionHash,
              logIndex: Number(log.logIndex || 0),
              timestamp: Number(block.timestamp),
              eventName: 'Swap',
              sender: args.sender as string,
              recipient: args.recipient as string,
              amount0: (args.amount0 as bigint)?.toString(),
              amount1: (args.amount1 as bigint)?.toString(),
              sqrtPriceX96: (args.sqrtPriceX96 as bigint)?.toString(),
              liquidity: (args.liquidity as bigint)?.toString(),
              tick: args.tick as number,
            },
          });

          swapsProcessed++;

          if (verbose && swapsProcessed % 10 === 0) {
            console.log(`[SWAP_SYNC] Processed ${swapsProcessed}/${logs.length} swaps`);
          }
        } catch {
          if (verbose) {
            console.warn(`[SWAP_SYNC] Could not decode log at ${log.transactionHash}:${log.logIndex}`);
          }
        }
      }
    }

    if (verbose) {
      console.log(`[SWAP_SYNC] Completed: ${swapsProcessed} swaps ingested`);
    }

    return {
      success: true,
      swapsIngested: swapsProcessed,
    };
  } catch (error) {
    console.error('[SWAP_SYNC] Error syncing pool swaps:', error);
    return {
      success: false,
      swapsIngested: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

