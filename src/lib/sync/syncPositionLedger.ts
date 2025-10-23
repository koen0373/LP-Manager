import { publicClient } from '@/lib/viemClient';
import { getPositionById } from '@/services/pmFallback';
import { getPositionNftTransfers } from '@/services/flarescanService';
import { decodeEventLog, Hex, encodeEventTopics } from 'viem';
import { UNISWAP_V3_POOL_ABI } from '@/abis/UniswapV3Pool';
import { POSITION_MANAGER_EVENTS_ABI } from '@/abis/PositionManagerEvents';
import { 
  bulkUpsertPositionEvents, 
  PositionEventData 
} from '@/lib/data/positionEvents';
import { 
  bulkUpsertPositionTransfers, 
  PositionTransferData 
} from '@/lib/data/positionTransfers';
import { PositionEventType } from '@prisma/client';
import { bigIntToDecimal, tickToPrice } from '@/utils/poolHelpers';

const POSITION_MANAGER_ADDRESS = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657';

interface SyncOptions {
  fromBlock?: number;
  toBlock?: number;
  verbose?: boolean;
}

export async function syncPositionLedger(
  tokenId: string,
  options: SyncOptions = {}
): Promise<{
  success: boolean;
  eventsIngested: number;
  transfersIngested: number;
  events: PositionEventData[];
  transfers: PositionTransferData[];
  error?: string;
}> {
  const { verbose = false } = options;

  try {
    if (verbose) {
      console.log(`[SYNC] Starting ledger sync for position ${tokenId}`);
    }

    // Step 1: Fetch position data to get pool address
    const position = await getPositionById(tokenId);
    if (!position) {
      throw new Error(`Position ${tokenId} not found`);
    }

    if (verbose) {
      console.log(`[SYNC] Found position ${tokenId} in pool ${position.poolAddress}`);
    }

    // Step 2: Fetch and process NFT transfers
    const transfers = await getPositionNftTransfers(POSITION_MANAGER_ADDRESS, tokenId);
    if (verbose) {
      console.log(`[SYNC] Found ${transfers.length} NFT transfers`);
    }

    const positionTransfers: PositionTransferData[] = transfers
      .filter(transfer => transfer.txHash) // Filter out transfers without txHash
      .map((transfer, index) => ({
        id: `${transfer.txHash}:${index}`,
        tokenId,
        from: transfer.from,
        to: transfer.to,
        blockNumber: transfer.blockNumber,
        txHash: transfer.txHash,
        logIndex: index, // Use array index as logIndex
        timestamp: transfer.timestamp || Math.floor(Date.now() / 1000), // Use current time as fallback
        metadata: {
          value: '0',
        },
      }));

    // Step 3: Fetch pool events for this position
    const mintTransfer = transfers.find(t => t.from === '0x0000000000000000000000000000000000000000');
    const mintBlock = mintTransfer?.blockNumber || 0;

    if (verbose) {
      console.log(`[SYNC] Position minted at block ${mintBlock}`);
    }

    // Fetch logs from pool contract
    const latestBlock = await publicClient.getBlockNumber();
    const fromBlock = BigInt(options.fromBlock || mintBlock);
    const toBlock = BigInt(options.toBlock || latestBlock);

    if (verbose) {
      console.log(`[SYNC] Fetching pool events from block ${fromBlock} to ${toBlock}`);
    }

    const positionEvents: PositionEventData[] = [];

    // Fetch events from TWO sources:
    // 1. Position Manager contract (IncreaseLiquidity, DecreaseLiquidity, Collect filtered by tokenId)
    // 2. Pool contract (Mint, Burn, Collect filtered by tick range)

    const chunkSize = 25n;
    
    // PART 1: Fetch Position Manager events (filtered by tokenId)
    if (verbose) {
      console.log(`[SYNC] Fetching Position Manager events for tokenId ${tokenId}...`);
    }

    for (let currentBlock = fromBlock; currentBlock <= toBlock; currentBlock += chunkSize) {
      const chunkEnd = currentBlock + chunkSize - 1n < toBlock 
        ? currentBlock + chunkSize - 1n 
        : toBlock;

      try {
        // Position Manager events: IncreaseLiquidity, DecreaseLiquidity, Collect
        const pmLogs = await publicClient.getLogs({
          address: POSITION_MANAGER_ADDRESS as Hex,
          fromBlock: currentBlock,
          toBlock: chunkEnd,
          // Filter events by tokenId (first indexed parameter)
          event: {
            type: 'event',
            name: 'IncreaseLiquidity',
            inputs: [
              { type: 'uint256', indexed: true, name: 'tokenId' },
            ],
          },
          args: {
            tokenId: BigInt(tokenId),
          },
        });

        // Also fetch DecreaseLiquidity events
        const pmDecreaseLogs = await publicClient.getLogs({
          address: POSITION_MANAGER_ADDRESS as Hex,
          fromBlock: currentBlock,
          toBlock: chunkEnd,
          event: {
            type: 'event',
            name: 'DecreaseLiquidity',
            inputs: [
              { type: 'uint256', indexed: true, name: 'tokenId' },
            ],
          },
          args: {
            tokenId: BigInt(tokenId),
          },
        });

        // Also fetch Collect events from Position Manager
        const pmCollectLogs = await publicClient.getLogs({
          address: POSITION_MANAGER_ADDRESS as Hex,
          fromBlock: currentBlock,
          toBlock: chunkEnd,
          event: {
            type: 'event',
            name: 'Collect',
            inputs: [
              { type: 'uint256', indexed: true, name: 'tokenId' },
            ],
          },
          args: {
            tokenId: BigInt(tokenId),
          },
        });

        const allPmLogs = [...pmLogs, ...pmDecreaseLogs, ...pmCollectLogs];

        if (verbose && allPmLogs.length > 0) {
          console.log(`[SYNC] Found ${allPmLogs.length} Position Manager logs in block range ${currentBlock}-${chunkEnd}`);
        }

        // Process Position Manager logs
        for (const log of allPmLogs) {
          try {
            const decoded = decodeEventLog({
              abi: POSITION_MANAGER_EVENTS_ABI,
              data: log.data,
              topics: log.topics,
            });

            const eventType = mapEventType(decoded.eventName);
            if (!eventType) continue;

            // Get block timestamp
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
            const timestamp = Number(block.timestamp);

            // Extract position metadata for calculations
            const price0Usd = position.price0Usd || 0;
            const price1Usd = position.price1Usd || 0;
            const decimals0 = position.token0.decimals || 18;
            const decimals1 = position.token1.decimals || 18;

            // Extract amounts from decoded args
            const args = decoded.args as Record<string, unknown>;
            
            // Get amount, amount0, amount1, liquidity safely
            const amount0BigInt = (args?.amount0 as bigint) || 0n;
            const amount1BigInt = (args?.amount1 as bigint) || 0n;
            const liquidityBigInt = (args?.liquidity as bigint) || (args?.amount as bigint) || 0n;
            const sqrtPriceX96 = args?.sqrtPriceX96 as bigint;
            const tick = args?.tick as number;

            // Convert to decimal for USD calculations
            const amount0Decimal = amount0BigInt ? bigIntToDecimal(amount0BigInt, decimals0) : 0;
            const amount1Decimal = amount1BigInt ? bigIntToDecimal(amount1BigInt, decimals1) : 0;

            // Calculate price1Per0 using tick or fallback
            let price1Per0 = 0;
            try {
              const tickForPrice = tick ?? position.currentTick ?? 0;
              if (tickForPrice !== 0) {
                price1Per0 = tickToPrice(tickForPrice, decimals0, decimals1);
              } else {
                // Fallback to price ratio
                price1Per0 = price0Usd > 0 ? price1Usd / price0Usd : 0;
              }
            } catch {
              // Fallback to price ratio if tickToPrice fails
              price1Per0 = price0Usd > 0 ? price1Usd / price0Usd : 0;
            }

            // Calculate USD value
            const usdValue = amount0Decimal * price0Usd + amount1Decimal * price1Usd;

            const event: PositionEventData = {
              id: `${log.transactionHash}:${log.logIndex}`,
              tokenId,
              pool: position.poolAddress,
              blockNumber: Number(log.blockNumber),
              txHash: log.transactionHash,
              logIndex: Number(log.logIndex || 0),
              timestamp,
              eventType,
              sender: (args?.sender as string) || (args?.owner as string),
              owner: args?.owner as string,
              recipient: args?.recipient as string,
              tickLower: position.tickLower,
              tickUpper: position.tickUpper,
              tick,
              liquidityDelta: liquidityBigInt?.toString(),
              amount0: amount0BigInt?.toString(),
              amount1: amount1BigInt?.toString(),
              sqrtPriceX96: sqrtPriceX96?.toString(),
              price1Per0,
              usdValue,
              metadata: {
                eventName: decoded.eventName,
                amount0Decimal,
                amount1Decimal,
              },
            };

            positionEvents.push(event);

            if (verbose) {
              console.log(`[SYNC] Processed ${decoded.eventName} event at block ${log.blockNumber}`);
            }
          } catch {
            // Skip events we can't decode
            if (verbose) {
              console.warn(`[SYNC] Could not decode log at ${log.transactionHash}:${log.logIndex}`);
            }
          }
        }
      } catch (chunkError) {
        console.error(`[SYNC] Error fetching chunk ${currentBlock}-${chunkEnd}:`, chunkError);
      }
    }

    // Step 4: Bulk insert into database (optional - gracefully handle failures)
    let dbWriteSuccess = false;
    try {
      if (verbose) {
        console.log(`[SYNC] Inserting ${positionTransfers.length} transfers into database`);
      }
      await bulkUpsertPositionTransfers(positionTransfers);

      if (verbose) {
        console.log(`[SYNC] Inserting ${positionEvents.length} events into database`);
      }
      await bulkUpsertPositionEvents(positionEvents);
      
      dbWriteSuccess = true;
      if (verbose) {
        console.log(`[SYNC] Successfully wrote to database for position ${tokenId}`);
      }
    } catch (dbError) {
      // Database write failed - log but don't fail the entire sync
      console.warn(`[SYNC] Database write failed for position ${tokenId} (continuing without persistence):`, dbError);
    }

    if (verbose) {
      console.log(`[SYNC] Ledger sync completed for position ${tokenId} (DB write: ${dbWriteSuccess ? 'success' : 'skipped'})`);
    }

    return {
      success: true,
      eventsIngested: positionEvents.length,
      transfersIngested: positionTransfers.length,
      events: positionEvents,
      transfers: positionTransfers,
    };
  } catch (error) {
    console.error(`[SYNC] Error syncing position ${tokenId}:`, error);
    return {
      success: false,
      eventsIngested: 0,
      transfersIngested: 0,
      events: [],
      transfers: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function checkEventRelevance(
  decoded: { eventName: string; args?: Record<string, unknown> }, 
  position: { tickLower: number; tickUpper: number; walletAddress?: string }
): boolean {
  const args = decoded.args || {};

  // For Mint, Burn, IncreaseLiquidity, DecreaseLiquidity: check tick range
  if (['Mint', 'Burn', 'IncreaseLiquidity', 'DecreaseLiquidity'].includes(decoded.eventName)) {
    if (args.tickLower !== undefined && args.tickUpper !== undefined) {
      return (
        args.tickLower === position.tickLower &&
        args.tickUpper === position.tickUpper
      );
    }
  }

  // For Collect events: check tick range AND owner/recipient matches wallet
  if (decoded.eventName === 'Collect') {
    const ticksMatch = 
      args.tickLower === position.tickLower &&
      args.tickUpper === position.tickUpper;
    
    if (!ticksMatch) return false;

    // If we have wallet address, verify owner/recipient
    if (position.walletAddress) {
      const owner = (args.owner as string)?.toLowerCase();
      const recipient = (args.recipient as string)?.toLowerCase();
      const wallet = position.walletAddress.toLowerCase();
      
      return owner === wallet || recipient === wallet;
    }

    // No wallet check, just tick range match
    return true;
  }

  return false;
}

function mapEventType(eventName: string): PositionEventType | null {
  const mapping: Record<string, PositionEventType> = {
    'Mint': 'MINT',
    'Burn': 'BURN',
    'Collect': 'COLLECT',
    'Swap': 'SWAP',
    'IncreaseLiquidity': 'INCREASE',
    'DecreaseLiquidity': 'DECREASE',
  };

  return mapping[eventName] || null;
}

export async function syncMultiplePositions(
  tokenIds: string[],
  options: SyncOptions = {}
): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    tokenId: string;
    success: boolean;
    eventsIngested: number;
    transfersIngested: number;
    error?: string;
  }>;
}> {
  const { verbose = false } = options;

  if (verbose) {
    console.log(`[SYNC] Starting batch sync for ${tokenIds.length} positions`);
  }

  const results = [];
  let successful = 0;
  let failed = 0;

  for (const tokenId of tokenIds) {
    const result = await syncPositionLedger(tokenId, { ...options, verbose: false });
    
    if (result.success) {
      successful++;
    } else {
      failed++;
    }

    results.push({
      tokenId,
      ...result,
    });

    if (verbose) {
      console.log(
        `[SYNC] Progress: ${successful + failed}/${tokenIds.length} ` +
        `(${successful} successful, ${failed} failed)`
      );
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  if (verbose) {
    console.log(`[SYNC] Batch sync completed: ${successful} successful, ${failed} failed`);
  }

  return {
    total: tokenIds.length,
    successful,
    failed,
    results,
  };
}
