import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/store/prisma';
import { getCapitalFlowStats } from '@/lib/data/capitalFlows';
import { getPositionEventsByWallet } from '@/lib/data/positionEvents';
import { PositionEventType } from '@prisma/client';
import { getLpPositionsOnChain } from '@/services/pmFallback';

interface WalletSummaryResponse {
  wallet: string;
  totals: {
    tvlUsd: number;
    feesRealizedUsd: number;
    rewardsUsd: number;
    unclaimedFeesUsd: number;
    rflrAmount: number;
    rflrUsd: number;
    capitalInvestedUsd: number;
    roiPct: number;
  };
  positions: Array<{
    tokenId: string;
    pool: string;
    pairLabel: string;
    token0Symbol: string;
    token1Symbol: string;
    status: 'active' | 'inactive';
    tvlUsd: number;
    accruedFeesUsd: number;
    realizedFeesUsd: number;
    rflrAmount: number;
    rflrUsd: number;
  }>;
  capitalTimeline: Array<{
    timestamp: number;
    balanceUsd: number;
    type: 'deposit' | 'withdraw' | 'fees' | 'rewards';
    txHash: string;
  }>;
  recentActivity: Array<{
    timestamp: number;
    label: string;
    txHash: string;
    amountUsd: number;
  }>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WalletSummaryResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  const startTime = Date.now();
  console.log(`[API] /api/wallet/summary - Start for ${address}`);

  try {
    // Step 1: Get live positions for TVL calculation
    // Use the same method as /api/positions for consistency
    console.log(`[WALLET_SUMMARY] Fetching live positions for ${address}`);
    const livePositions = await getLpPositionsOnChain(address as `0x${string}`);

    // Step 2: Get position ownership from transfers
    console.log(`[WALLET_SUMMARY] Fetching position transfers for ${address}`);
    // const transfers = await db.positionTransfer.findMany({
    //   where: {
    //     OR: [
    //       { from: address },
    //       { to: address },
    //     ],
    //   },
    //   orderBy: { timestamp: 'desc' },
    // });
    // TODO: Use transfers to validate position ownership

    // Step 3: Get capital flow statistics
    console.log(`[WALLET_SUMMARY] Fetching capital flows for ${address}`);
    const capitalStats = await getCapitalFlowStats(address);

    // Step 4: Get COLLECT and DECREASE events for realized fees filtering
    console.log(`[WALLET_SUMMARY] Fetching COLLECT and DECREASE events for ${address}`);
    const allEvents = await getPositionEventsByWallet(address, {
      eventTypes: [PositionEventType.COLLECT, PositionEventType.DECREASE],
      limit: 2000, // Get more to ensure we capture all
    });

    // Filter out COLLECT events that are part of DECREASE transactions
    // (Uniswap V3 auto-collects fees when decreasing liquidity)
    const decreaseTxHashes = new Set(
      allEvents
        .filter((e) => e.eventType === PositionEventType.DECREASE)
        .map((e) => e.txHash)
    );

    const collectEvents = allEvents.filter(
      (event) => 
        event.eventType === PositionEventType.COLLECT &&
        !decreaseTxHashes.has(event.txHash)
    );

    // Calculate total realized fees from COLLECT events (excluding auto-collects)
    const feesRealizedUsd = collectEvents.reduce(
      (sum, event) => sum + (event.usdValue ?? 0),
      0
    );

    // Build map of realized fees per tokenId
    const realizedFeesMap = new Map<string, number>();
    for (const event of collectEvents) {
      const current = realizedFeesMap.get(event.tokenId) || 0;
      realizedFeesMap.set(event.tokenId, current + (event.usdValue ?? 0));
    }

    // Calculate totals from live positions
    const totalTvlUsd = livePositions.reduce((sum, pos) => sum + pos.tvlUsd, 0);

    // Calculate unclaimed fees (using unclaimedFeesUsd which was set by pmFallback)
    const totalUnclaimedFeesUsd = livePositions.reduce(
      (sum, pos) => sum + (pos.unclaimedFeesUsd || 0),
      0
    );

    // Calculate total RFLR rewards
    const totalRflrUsd = livePositions.reduce(
      (sum, pos) => sum + (pos.rflrUsd || 0),
      0
    );

    // Calculate total RFLR amount
    const totalRflrAmount = livePositions.reduce(
      (sum, pos) => sum + (pos.rflrAmount || 0),
      0
    );

    // Total rewards = unclaimed fees + RFLR rewards
    const totalRewardsUsd = totalUnclaimedFeesUsd + totalRflrUsd;

    // Calculate capital invested
    // If we have capital flow data, use it. Otherwise, estimate from TVL + realized fees
    let capitalInvestedUsd: number;
    if (capitalStats.totalDepositsUsd > 0) {
      capitalInvestedUsd = capitalStats.totalDepositsUsd - capitalStats.totalWithdrawalsUsd;
    } else {
      // Estimate: current TVL is roughly what was invested (ignoring price changes)
      capitalInvestedUsd = totalTvlUsd;
    }

    // Calculate ROI
    const currentValue = totalTvlUsd + feesRealizedUsd + totalRewardsUsd;
    const roiPct = capitalInvestedUsd > 0
      ? ((currentValue - capitalInvestedUsd) / capitalInvestedUsd) * 100
      : 0;

    // Map positions with realized fees from COLLECT events
    const positions = livePositions.map(pos => {
      const realizedFeesUsd = realizedFeesMap.get(pos.id) || 0;

      return {
        tokenId: pos.id,
        pool: pos.poolAddress,
        pairLabel: pos.pairLabel || '',
        token0Symbol: pos.token0?.symbol || '',
        token1Symbol: pos.token1?.symbol || '',
        status: (pos.tvlUsd > 0 ? 'active' : 'inactive') as 'active' | 'inactive',
        tvlUsd: pos.tvlUsd,
        accruedFeesUsd: pos.rewardsUsd,
        realizedFeesUsd,
        rflrAmount: pos.rflrAmount || 0,
        rflrUsd: pos.rflrUsd || 0,
      };
    });

    // TODO: Build capital timeline from CapitalFlow
    const capitalFlows = await db.capitalFlow.findMany({
      where: { wallet: address },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    const capitalTimeline = capitalFlows.map(flow => {
      let type: 'deposit' | 'withdraw' | 'fees' | 'rewards';
      switch (flow.flowType) {
        case 'DEPOSIT':
          type = 'deposit';
          break;
        case 'WITHDRAW':
          type = 'withdraw';
          break;
        case 'FEES_REALIZED':
        case 'FEES_REINVESTED':
          type = 'fees';
          break;
        default:
          type = 'rewards';
      }

      return {
        timestamp: flow.timestamp,
        balanceUsd: flow.amountUsd,
        type,
        txHash: flow.txHash,
      };
    });

    // Build recent activity from COLLECT events + CapitalFlow
    const recentActivity = [
      // Map COLLECT events
      ...collectEvents.slice(0, 20).map(event => ({
        timestamp: event.timestamp,
        label: formatEventLabel(event.eventType),
        txHash: event.txHash,
        amountUsd: event.usdValue ?? 0,
      })),
      // Map capital flows
      ...capitalFlows.slice(0, 10).map(flow => ({
        timestamp: flow.timestamp,
        label: formatFlowLabel(flow.flowType),
        txHash: flow.txHash,
        amountUsd: flow.amountUsd,
      })),
    ]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    const duration = Date.now() - startTime;
    console.log(
      `[API] /api/wallet/summary - Success for ${address} - ${duration}ms ` +
      `(${livePositions.length} positions, ${recentActivity.length} activities)`
    );

    const response: WalletSummaryResponse = {
      wallet: address,
      totals: {
        tvlUsd: totalTvlUsd,
        feesRealizedUsd,
        rewardsUsd: totalRewardsUsd,
        unclaimedFeesUsd: totalUnclaimedFeesUsd,
        rflrAmount: totalRflrAmount,
        rflrUsd: totalRflrUsd,
        capitalInvestedUsd,
        roiPct,
      },
      positions,
      capitalTimeline,
      recentActivity,
    };

    res.status(200).json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API] /api/wallet/summary - Error for ${address} - ${duration}ms:`, error);
    res.status(500).json({
      error: 'Failed to fetch wallet summary',
    });
  }
}

function formatEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    'MINT': 'Position Created',
    'INCREASE': 'Liquidity Added',
    'DECREASE': 'Liquidity Removed',
    'COLLECT': 'Fees Collected',
    'BURN': 'Position Closed',
    'SWAP': 'Swap',
  };
  return labels[eventType] || eventType;
}

function formatFlowLabel(flowType: string): string {
  const labels: Record<string, string> = {
    'DEPOSIT': 'Capital Deposited',
    'WITHDRAW': 'Capital Withdrawn',
    'FEES_REALIZED': 'Fees Collected',
    'FEES_REINVESTED': 'Fees Reinvested',
    'TRANSFER': 'Transfer',
  };
  return labels[flowType] || flowType;
}
