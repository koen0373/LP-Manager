import { NextApiRequest, NextApiResponse } from 'next';
import { getPositionById } from '@/services/pmFallback';
import { PoolDetailVM, PoolActivityEntry } from '@/features/poolDetail/types';
import { getTokenPriceForRewards } from '@/services/tokenPrices';
// import { getApsRewardForPosition } from '@/services/apsRewards';
import { tickToPrice, bigIntToDecimal } from '@/utils/poolHelpers';
import {
  getContractCreationDate,
  getPositionNftTransfers,
} from '@/services/flarescanService';
import { publicClient } from '@/lib/viemClient';
import { decodeEventLog, Hex } from 'viem';
import { UNISWAP_V3_POOL_ABI } from '@/abis/UniswapV3Pool';
import { fetchLatestBlockNumber } from '@/lib/adapters/rpcLogs';
import { clearCache } from '@/lib/util/memo';
import { syncPositionLedger } from '@/lib/sync/syncPositionLedger';
import { PositionEventType } from '@prisma/client';
import { buildPriceHistory, buildPriceHistoryFromSwaps } from '@/lib/data/priceHistory';
import { calculateApy } from '@/lib/calculations/apy';
import { calculateImpermanentLoss } from '@/lib/calculations/impermanentLoss';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now();
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenId } = req.query;
  const forceRefresh = req.query.refresh === '1';

  if (!tokenId || typeof tokenId !== 'string') {
    return res.status(400).json({ error: 'Token ID is required' });
  }

  try {
    console.log(`[API] Fetching pool data for token ID: ${tokenId}`);
    
    // Clear caches if refresh is requested
    if (forceRefresh) {
      clearCache(`position-${tokenId}`);
    }
    
    // Get position data
    const position = await getPositionById(tokenId);
    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const POSITION_MANAGER_ADDRESS = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657';
    const MINT_TOPIC =
      '0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde';
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    const transfers = await getPositionNftTransfers(POSITION_MANAGER_ADDRESS, tokenId, {
      refresh: forceRefresh,
    });
    const mintTransfer = transfers.find((transfer) => transfer.from.toLowerCase() === ZERO_ADDRESS);
    const fromBlock =
      mintTransfer?.blockNumber ??
      (transfers.length ? Math.min(...transfers.map((transfer) => transfer.blockNumber)) : 0);
    // Only sync ledger on refresh or if no data exists
    let ledgerEvents: Awaited<ReturnType<typeof syncPositionLedger>>['events'] = [];
    let ledgerTransfers: Awaited<ReturnType<typeof syncPositionLedger>>['transfers'] = [];
    
    if (forceRefresh) {
      console.log(`[API] Force refresh - syncing ledger for token ${tokenId}`);
      let latestBlock = fromBlock;
      try {
        latestBlock = await fetchLatestBlockNumber();
      } catch (error) {
        console.warn(`[API] Failed to fetch latest block number for token ${tokenId}:`, error);
        latestBlock = Math.max(fromBlock, 0);
      }
      const syncResult = await syncPositionLedger(tokenId, {
        fromBlock,
        toBlock: latestBlock,
        verbose: true,
      });
      if (syncResult.success) {
        ledgerEvents = syncResult.events;
        ledgerTransfers = syncResult.transfers;
      } else {
        console.error(`[API] Sync failed for token ${tokenId}:`, syncResult.error);
      }
    } else {
      // Use database cache - much faster!
      // Wrap in try-catch for production (Vercel) where database might not be available
      try {
        console.log(`[API] Using cached ledger data for token ${tokenId}`);
        const { getPositionEvents } = await import('@/lib/data/positionEvents');
        const { getPositionTransfers } = await import('@/lib/data/positionTransfers');
        
        const [dbEvents, dbTransfers] = await Promise.all([
          getPositionEvents(tokenId, { limit: 1000 }),
          getPositionTransfers(tokenId, { limit: 100 }),
        ]);
        
        // Convert Prisma null to undefined for TypeScript compatibility
        ledgerEvents = dbEvents.map(e => ({
          ...e,
          sender: e.sender ?? undefined,
          owner: e.owner ?? undefined,
          recipient: e.recipient ?? undefined,
          tickLower: e.tickLower ?? undefined,
          tickUpper: e.tickUpper ?? undefined,
          tick: e.tick ?? undefined,
          liquidityDelta: e.liquidityDelta ?? undefined,
          amount0: e.amount0 ?? undefined,
          amount1: e.amount1 ?? undefined,
          sqrtPriceX96: e.sqrtPriceX96 ?? undefined,
          price1Per0: e.price1Per0 ?? undefined,
          usdValue: e.usdValue ?? undefined,
          metadata: e.metadata as Record<string, unknown> | undefined,
        }));
        
        ledgerTransfers = dbTransfers.map(t => ({
          ...t,
          metadata: t.metadata as Record<string, unknown> | undefined,
        }));
        
        console.log(`[API] Retrieved ${ledgerEvents.length} events and ${ledgerTransfers.length} transfers from database for token ${tokenId}`);
        
        // If no events found in database (only transfers), force sync to get Position Manager events
        if (ledgerEvents.length === 0) {
          console.log(`[API] No cached data found for token ${tokenId}, syncing from blockchain...`);
          let latestBlock = fromBlock;
          try {
            latestBlock = await fetchLatestBlockNumber();
          } catch (error) {
            console.warn(`[API] Failed to fetch latest block number for token ${tokenId}:`, error);
            latestBlock = Math.max(fromBlock, 0);
          }
          const syncResult = await syncPositionLedger(tokenId, {
            fromBlock,
            toBlock: latestBlock,
            verbose: true,
          });
          if (syncResult.success) {
            ledgerEvents = syncResult.events;
            ledgerTransfers = syncResult.transfers;
            console.log(`[API] Synced ${ledgerEvents.length} events and ${ledgerTransfers.length} transfers for token ${tokenId}`);
          } else {
            console.error(`[API] Sync failed for token ${tokenId}:`, syncResult.error);
          }
        }
      } catch (dbError) {
        console.error(`[API] Database error for token ${tokenId}:`, dbError);
        // Try to sync from blockchain as fallback
        console.log(`[API] Falling back to blockchain sync for token ${tokenId}`);
        let latestBlock = fromBlock;
        try {
          latestBlock = await fetchLatestBlockNumber();
        } catch (error) {
          console.warn(`[API] Failed to fetch latest block number for token ${tokenId}:`, error);
          latestBlock = Math.max(fromBlock, 0);
        }
        try {
          const syncResult = await syncPositionLedger(tokenId, {
            fromBlock,
            toBlock: latestBlock,
            verbose: true,
          });
          if (syncResult.success) {
            ledgerEvents = syncResult.events;
            ledgerTransfers = syncResult.transfers;
            console.log(`[API] Synced ${ledgerEvents.length} events and ${ledgerTransfers.length} transfers for token ${tokenId} after DB error`);
          } else {
            console.error(`[API] Sync failed for token ${tokenId}:`, syncResult.error);
            ledgerEvents = [];
            ledgerTransfers = [];
          }
        } catch (syncError) {
          console.error(`[API] Failed to sync from blockchain for token ${tokenId}:`, syncError);
          ledgerEvents = [];
          ledgerTransfers = [];
        }
      }
    }

    // Get current prices for accurate rewards calculation
    const [currentPrice0Usd, currentPrice1Usd, currentRflrPriceUsd] = await Promise.all([
      getTokenPriceForRewards(position.token0.symbol),
      getTokenPriceForRewards(position.token1.symbol),
      getTokenPriceForRewards('RFLR'),
    ]);
    
    // Calculate current price from the actual pool tick (more accurate than external prices)
    const currentTick = position.currentTick || 0;
    const price0Per1 = tickToPrice(currentTick, position.token0.decimals, position.token1.decimals);
    
    // For range display, we want to show the price in USDT per token
    // If token1 is USDT, then currentPrice = price0Per1 (token0 per USDT)
    // If token0 is USDT, then currentPrice = 1/price0Per1 (USDT per token1)
    let currentPrice: number;
    let lowerPrice: number;
    let upperPrice: number;
    
    const isToken1Stable = position.token1.symbol === 'USD₮0' || position.token1.symbol === 'USDT' || position.token1.symbol === 'USDC';
    const isToken0Stable = position.token0.symbol === 'USD₮0' || position.token0.symbol === 'USDT' || position.token0.symbol === 'USDC';
    
    if (isToken1Stable) {
      // Token1 is USDT, so price0Per1 gives us token0 per USDT
      currentPrice = price0Per1;
      lowerPrice = position.lowerPrice;
      upperPrice = position.upperPrice;
    } else if (isToken0Stable) {
      // Token0 is USDT, so 1/price0Per1 gives us USDT per token1
      currentPrice = price0Per1 > 0 ? 1 / price0Per1 : 0;
      // Also invert the range prices!
      lowerPrice = position.upperPrice > 0 ? 1 / position.upperPrice : 0;
      upperPrice = position.lowerPrice > 0 ? 1 / position.lowerPrice : 0;
    } else {
      // Neither token is USDT, use the ratio as is
      currentPrice = price0Per1;
      lowerPrice = position.lowerPrice;
      upperPrice = position.upperPrice;
    }
    // Check if current price is within range using tick-based price
    const inRange = currentPrice >= lowerPrice && currentPrice <= upperPrice;
    
    let initialAmount0 = position.amount0;
    let initialAmount1 = position.amount1;
    let initialTimestamp: Date | null = null;

    if (mintTransfer) {
      initialTimestamp = new Date(mintTransfer.timestamp * 1000);
      try {
        const receipt = await publicClient.getTransactionReceipt({
          hash: mintTransfer.txHash as `0x${string}`,
        });

        const mintLog = receipt.logs.find(
          (log) =>
            log.address?.toLowerCase() === position.poolAddress.toLowerCase() &&
            log.topics?.[0]?.toLowerCase() === MINT_TOPIC
        );

        if (mintLog && mintLog.topics && mintLog.topics.length > 0) {
          const topics = mintLog.topics as unknown as [Hex, ...Hex[]];
          const decoded = decodeEventLog({
            abi: UNISWAP_V3_POOL_ABI,
            data: mintLog.data as Hex,
            topics,
          });

          const args = decoded.args as { amount0: bigint; amount1: bigint };
          initialAmount0 = bigIntToDecimal(args.amount0, position.token0.decimals);
          initialAmount1 = bigIntToDecimal(args.amount1, position.token1.decimals);
        }
      } catch (error) {
        console.warn('[API] Failed to decode mint event for initial snapshot', error);
      }
    }

    const token0Amount = position.amount0;
    const token1Amount = position.amount1;
    const totalValue = position.tvlUsd;
    const initialUsd0 = initialAmount0 * currentPrice0Usd;
    const initialUsd1 = initialAmount1 * currentPrice1Usd;
    const initialUsd = initialUsd0 + initialUsd1;
    const ratioToken0Usd = initialUsd > 0 ? initialUsd0 / initialUsd : 0;
    const ratioToken1Usd = initialUsd > 0 ? Math.max(0, 1 - ratioToken0Usd) : 0;
    
    const poolRewards = (position.fee0 || 0) * currentPrice0Usd + (position.fee1 || 0) * currentPrice1Usd;
    const rflrRewards = (position.rflrAmount || 0) * currentRflrPriceUsd;
    
    // APS removed for Phase 3 - will add back later when needed
    // Get APS rewards (parallel)
    // const [apsData, currentApsPriceUsd] = await Promise.all([
    //   getApsRewardForPosition(tokenId),
    //   getTokenPriceForRewards('APS'),
    // ]);
    // const apsAmount = apsData?.amount || 0;
    // const apsRewards = apsAmount * currentApsPriceUsd;

    const blockTimestampCache = new Map<number, number>();
    const resolveTimestamp = async (blockNumber: number, fallback?: number) => {
      if (fallback && fallback > 0) {
        return fallback;
      }
      if (blockTimestampCache.has(blockNumber)) {
        return blockTimestampCache.get(blockNumber)!;
      }
      try {
        const block = await publicClient.getBlock({ blockNumber: BigInt(blockNumber) });
        const ts = Number(block.timestamp);
        blockTimestampCache.set(blockNumber, ts);
        return ts;
      } catch (error) {
        console.warn(`[API] Failed to resolve block timestamp for ${blockNumber}:`, error);
        const fallbackTs = Math.floor(Date.now() / 1000);
        blockTimestampCache.set(blockNumber, fallbackTs);
        return fallbackTs;
      }
    };

    const transferHistory = ledgerTransfers.length ? ledgerTransfers : transfers;

    const feeClaimHistory: Array<{
      timestamp: number;
      amount0: number;
      amount1: number;
      valueUsd: number;
      hash: string;
      poolAddress: string;
    }> = [];
    let totalClaimedFees = 0;
    let firstClaimDate: Date | null = null;
    let lastClaimDate: Date | null = null;
    
    // Get all DECREASE tx hashes to filter out auto-collects
    // (Uniswap V3 auto-collects fees when decreasing liquidity)
    const decreaseTxHashes = new Set(
      ledgerEvents
        .filter((e) => e.eventType === PositionEventType.DECREASE)
        .map((e) => e.txHash)
    );

    const collectEvents = ledgerEvents.filter(
      (event) => event.eventType === PositionEventType.COLLECT
    );

    for (const event of collectEvents) {
      // Skip COLLECT events that are part of a DECREASE transaction
      // (DECREASE automatically collects fees as part of removing liquidity)
      if (decreaseTxHashes.has(event.txHash)) {
        continue;
      }

      const rawAmount0 = event.amount0 ? BigInt(event.amount0) : 0n;
      const rawAmount1 = event.amount1 ? BigInt(event.amount1) : 0n;
      const amount0 = bigIntToDecimal(rawAmount0, position.token0.decimals);
      const amount1 = bigIntToDecimal(rawAmount1, position.token1.decimals);
      const valueUsd = amount0 * currentPrice0Usd + amount1 * currentPrice1Usd;
      const tsMs = (event.timestamp ?? Math.floor(Date.now() / 1000)) * 1000;

      feeClaimHistory.push({
        timestamp: tsMs,
        amount0,
        amount1,
        valueUsd,
        hash: event.txHash,
        poolAddress: event.pool,
      });

      totalClaimedFees += valueUsd;

      const claimDate = new Date(tsMs);
      if (!firstClaimDate || claimDate < firstClaimDate) {
        firstClaimDate = claimDate;
      }
      if (!lastClaimDate || claimDate > lastClaimDate) {
        lastClaimDate = claimDate;
      }
    }

    feeClaimHistory.sort((a, b) => a.timestamp - b.timestamp);

    // Parallel: Get contract creation date and build price history
    const [contractCreationDateResult, priceHistoryResult] = await Promise.allSettled([
      getContractCreationDate(position.poolAddress),
      (async () => {
        const poolCreationDate = initialTimestamp || new Date();
        const creationTimestamp = Math.floor(poolCreationDate.getTime() / 1000);
        
        // Build price history from ledger events (they have tick/price data)
        let history: { t: string; p: number }[] = [];
        
        if (ledgerEvents.length > 0) {
          console.log('[API] Building price history from ledger events');
          history = ledgerEvents
            .filter(e => e.price1Per0 !== undefined && e.price1Per0 > 0)
            .map(e => ({
              t: e.timestamp.toString(),
              p: e.price1Per0!,
            }))
            .sort((a, b) => Number(a.t) - Number(b.t));
          
          console.log(`[API] Built ${history.length} price points from ${ledgerEvents.length} ledger events`);
        }
        
        // If no ledger events with price, try database
        if (history.length === 0) {
          console.log('[API] No price from ledger, trying database...');
          history = await buildPriceHistory(
            position.poolAddress,
            position.token0.decimals,
            position.token1.decimals,
            {
              fromTimestamp: creationTimestamp,
              toTimestamp: Math.floor(Date.now() / 1000),
              maxPoints: 500,
            }
          );
        }
        
        // Fallback to pool swaps if still no data
        if (history.length === 0) {
          console.log('[API] No price history from position events, trying pool swaps...');
          history = await buildPriceHistoryFromSwaps(
            position.poolAddress,
            position.token0.decimals,
            position.token1.decimals,
            {
              fromTimestamp: creationTimestamp,
              toTimestamp: Math.floor(Date.now() / 1000),
              maxPoints: 500,
            }
          );
        }
        
        // Always add current price as latest point if we have it
        if (currentPrice > 0 && !isNaN(currentPrice)) {
          const now = Math.floor(Date.now() / 1000);
          history.push({ t: now.toString(), p: currentPrice });
        }
        
        // If still no data after all attempts, create minimal fallback
        if (history.length === 0 && currentPrice > 0 && !isNaN(currentPrice)) {
          console.log('[API] No historical data available, creating minimal fallback');
          const now = Math.floor(Date.now() / 1000);
          history = [
            { t: (now - 3600).toString(), p: currentPrice },  // 1h ago
            { t: now.toString(), p: currentPrice },           // Now
          ];
        } else if (history.length === 0) {
          console.warn('[API] Cannot create fallback chart: missing price data', { currentPrice });
        }
        
        // Debug: Log final priceHistory
        console.log(`[API] Final priceHistory for ${position.token0.symbol}/${position.token1.symbol}:`, {
          points: history.length,
          first: history[0],
          last: history[history.length - 1],
          currentPrice,
          lowerPrice,
          upperPrice,
        });
        
        return history;
      })()
    ]);

    const contractCreationDate = contractCreationDateResult.status === 'fulfilled' 
      ? contractCreationDateResult.value 
      : (console.warn('[API] Failed to fetch contract creation date, using mint timestamp as fallback:', 
          contractCreationDateResult.reason?.message), null);
    
    const priceHistory = priceHistoryResult.status === 'fulfilled' 
      ? priceHistoryResult.value 
      : [];
    
    console.log(`[API] Built price history with ${priceHistory.length} points`);

    // Determine pool creation date
    const poolCreationDate = initialTimestamp || contractCreationDate || new Date();

    const valueHistory: Array<{ t: string; v: number }> = [];

    const totalRewardsUsd = totalClaimedFees + poolRewards + rflrRewards; // + apsRewards (removed for Phase 3)

    const shortAddress = (address: string | undefined) =>
      address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '—';
    const formatUsd = (value: number) => `$${value.toFixed(2)}`;
    const formatTokenDelta = (value: number, symbol: string, sign: 'positive' | 'negative' | 'neutral') => {
      const abs = Math.abs(value);
      if (sign === 'neutral') return `${abs.toFixed(4)} ${symbol}`;
      const prefix = value === 0 ? '' : sign === 'negative' ? '-' : '+';
      return `${prefix}${abs.toFixed(4)} ${symbol}`;
    };

    const activityEntries: PoolActivityEntry[] = [];

    if (mintTransfer) {
      const mintTs = await resolveTimestamp(mintTransfer.blockNumber, mintTransfer.timestamp);
      activityEntries.push({
        id: `mint-${mintTransfer.txHash}`,
        type: 'mint',
        timestamp: new Date(mintTs * 1000).toISOString(),
        txHash: mintTransfer.txHash,
        title: 'Position Minted',
        subtitle: `${shortAddress(mintTransfer.to)} opened the position`,
        metrics: [
          {
            label: position.token0.symbol,
            value: formatTokenDelta(initialAmount0, position.token0.symbol, 'positive'),
            accent: 'token0',
          },
          {
            label: position.token1.symbol,
            value: formatTokenDelta(initialAmount1, position.token1.symbol, 'positive'),
            accent: 'token1',
          },
          {
            label: 'USD Value',
            value: formatUsd(initialUsd || totalValue),
            accent: 'positive',
          },
        ],
      });
    }

    for (const transfer of transferHistory) {
      if (transfer.from.toLowerCase() === ZERO_ADDRESS || transfer.txHash === mintTransfer?.txHash) {
        continue;
      }
      const ts = await resolveTimestamp(transfer.blockNumber, transfer.timestamp);
      activityEntries.push({
        id: `transfer-${transfer.txHash}-${transfer.blockNumber}`,
        type: 'transfer',
        timestamp: new Date(ts * 1000).toISOString(),
        txHash: transfer.txHash,
        title: 'Ownership Transferred',
        subtitle: `${shortAddress(transfer.from)} → ${shortAddress(transfer.to)}`,
        metrics: [
          { label: 'Block', value: `#${transfer.blockNumber}` },
          { label: 'Token ID', value: `#${tokenId}` },
        ],
      });
    }

    console.log(`[API] Processing ${ledgerEvents.length} ledger events for activity timeline`);
    
    for (const event of ledgerEvents) {
      const ts = await resolveTimestamp(event.blockNumber, event.timestamp);
      const amount0 = bigIntToDecimal(
        event.amount0 ? BigInt(event.amount0) : 0n,
        position.token0.decimals
      );
      const amount1 = bigIntToDecimal(
        event.amount1 ? BigInt(event.amount1) : 0n,
        position.token1.decimals
      );
      const usdValue = amount0 * currentPrice0Usd + amount1 * currentPrice1Usd;
      const iso = new Date(ts * 1000).toISOString();

      switch (event.eventType) {
        case PositionEventType.INCREASE:
          activityEntries.push({
            id: `increase-${event.txHash}-${event.blockNumber}`,
            type: 'increase',
            timestamp: iso,
            txHash: event.txHash,
            title: 'Liquidity Added',
            subtitle: 'Position liquidity increased',
            metrics: [
              {
                label: position.token0.symbol,
                value: formatTokenDelta(amount0, position.token0.symbol, 'positive'),
                accent: 'token0',
              },
              {
                label: position.token1.symbol,
                value: formatTokenDelta(amount1, position.token1.symbol, 'positive'),
                accent: 'token1',
              },
              { label: 'USD Delta', value: formatUsd(usdValue), accent: 'positive' },
            ],
          });
          break;
        case PositionEventType.DECREASE:
          activityEntries.push({
            id: `decrease-${event.txHash}-${event.blockNumber}`,
            type: 'decrease',
            timestamp: iso,
            txHash: event.txHash,
            title: 'Liquidity Removed',
            subtitle: 'Liquidity withdrawn from position',
            metrics: [
              {
                label: position.token0.symbol,
                value: formatTokenDelta(amount0, position.token0.symbol, 'negative'),
                accent: 'token0',
              },
              {
                label: position.token1.symbol,
                value: formatTokenDelta(amount1, position.token1.symbol, 'negative'),
                accent: 'token1',
              },
              { label: 'USD Delta', value: formatUsd(usdValue), accent: 'negative' },
            ],
          });
          break;
        case PositionEventType.COLLECT:
          // Skip COLLECT events that are part of a DECREASE transaction
          // (DECREASE automatically collects fees, don't show as separate claim)
          if (decreaseTxHashes.has(event.txHash)) {
            break; // Skip this event
          }
          
          activityEntries.push({
            id: `collect-${event.txHash}-${event.blockNumber}`,
            type: 'collect',
            timestamp: iso,
            txHash: event.txHash,
            title: 'Fees Claimed',
            subtitle: event.recipient ? `Sent to ${shortAddress(event.recipient)}` : undefined,
            metrics: [
              {
                label: position.token0.symbol,
                value: formatTokenDelta(amount0, position.token0.symbol, 'positive'),
                accent: 'token0',
              },
              {
                label: position.token1.symbol,
                value: formatTokenDelta(amount1, position.token1.symbol, 'positive'),
                accent: 'token1',
              },
              { label: 'USD Value', value: formatUsd(usdValue), accent: 'positive' },
            ],
          });
          break;
        case PositionEventType.BURN:
          activityEntries.push({
            id: `burn-${event.txHash}-${event.blockNumber}`,
            type: 'burn',
            timestamp: iso,
            txHash: event.txHash,
            title: 'Position Burned',
            subtitle: 'Liquidity completely removed',
            metrics: [
              {
                label: position.token0.symbol,
                value: formatTokenDelta(amount0, position.token0.symbol, 'negative'),
                accent: 'token0',
              },
              {
                label: position.token1.symbol,
                value: formatTokenDelta(amount1, position.token1.symbol, 'negative'),
                accent: 'token1',
              },
              { label: 'USD Delta', value: formatUsd(usdValue), accent: 'negative' },
            ],
          });
          break;
        default:
          break;
      }
    }

    // Final sort of activity entries by timestamp (most recent first)
    activityEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    console.log(`[API] Total activity entries: ${activityEntries.length} (${ledgerEvents.length} events + transfers)`);

    // ========================================
    // APY Calculation
    // ========================================
    // Total fees = claimed fees + unclaimed fees (poolRewards)
    const totalFeesEarned = totalClaimedFees + poolRewards;
    
    const apyResult = calculateApy(
      totalFeesEarned,       // Total fees earned (claimed + unclaimed)
      totalValue,            // Current TVL
      poolCreationDate,      // Pool creation date
      undefined,             // TODO: fees last 24h
      undefined,             // TODO: fees last 7d
      undefined,             // TODO: fees last 30d
      undefined              // TODO: fees last 365d
    );

    // ========================================
    // Impermanent Loss Calculation
    // ========================================
    // For IL, we need initial prices at deposit time
    // For now, we use current prices as approximation (will be inaccurate if prices changed significantly)
    // TODO: Get actual initial prices from MINT event timestamp
    const initialPrice0Usd = currentPrice0Usd; // TODO: Get from historical data
    const initialPrice1Usd = currentPrice1Usd; // TODO: Get from historical data
    
    const ilResult = calculateImpermanentLoss({
      initialAmount0,
      initialAmount1,
      initialPrice0Usd,
      initialPrice1Usd,
      currentPrice0Usd,
      currentPrice1Usd,
      currentTvlUsd: totalValue,
    });

    const vm: PoolDetailVM = {
      pairLabel: `${position.token0.symbol}/${position.token1.symbol}`,
      poolId: parseInt(position.id, 10),
      feeTierBps: position.feeTierBps,
      createdAt: poolCreationDate.toISOString(),
      poolAddress: position.poolAddress,
      token0: {
        symbol: position.token0.symbol,
        priceUsd: currentPrice0Usd
      },
      token1: {
        symbol: position.token1.symbol,
        priceUsd: currentPrice1Usd
      },
      range: {
        min: lowerPrice,
        max: upperPrice,
        current: currentPrice,
        inRange,
      },
      tvl: {
        tvlUsd: totalValue,
        amount0: token0Amount,
        amount1: token1Amount,
        feeApr: 0.12, // TODO: Calculate actual fee APR
        rflrApr: 0.08, // TODO: Calculate actual RFLR APR
        apy24h: apyResult.apy24h,
        apy7d: apyResult.apy7d,
        apy1m: apyResult.apy1m,
        apy1y: apyResult.apy1y,
        apyAllTime: apyResult.apyAllTime,
      },
      il: {
        ilPct: ilResult.ilPercentage,
        hodlValueUsd: ilResult.valueIfHeld,
        lpValueUsd: ilResult.valueAsLp,
      },
      rewards: {
        feesToken0: position.fee0 || 0,
        feesToken1: position.fee1 || 0,
        feesUsd: poolRewards,
        rflr: position.rflrAmount || 0,
        rflrUsd: rflrRewards,
        // APS removed for Phase 3 - will add back later
        reinvestedUsd: 0, // TODO: Calculate reinvested amount
        claimedUsd: totalClaimedFees,
        totalUsd: totalRewardsUsd,
      },
      funding: {
        timestamp: poolCreationDate.toISOString(),
        price1Per0: currentPrice,
        ratioToken0: ratioToken0Usd,
        ratioToken1: ratioToken1Usd,
        amount0: initialAmount0,
        amount1: initialAmount1,
        usdValue: initialUsd || totalValue,
      },
      priceHistory,
      tvlHistory: valueHistory,
      feesHistory: [],
      rflrHistory: [],
      activity: activityEntries,
      staleSeconds: 0,
      premium: false
    };

    const duration = Date.now() - startTime;
    console.log(`[API] /api/pool/${tokenId} - Success - ${duration}ms`);
    res.status(200).json(vm);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API] /api/pool/${tokenId} - Failed - ${duration}ms:`, error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to load pool data' 
    });
  }
}
