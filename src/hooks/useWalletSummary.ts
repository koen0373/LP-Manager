import { useQuery } from '@tanstack/react-query';

import { fetchPositions, computeSummary } from '@/lib/positions/client';
import type { PositionRow, PositionsResponse } from '@/lib/positions/types';

export interface WalletSummaryResponse {
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
    pairLabel?: string;
    token0Symbol?: string;
    token1Symbol?: string;
    status: 'active' | 'inactive';
    tvlUsd: number;
    accruedFeesUsd: number;
    realizedFeesUsd: number;
    rflrAmount?: number;
    rflrUsd?: number;
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
  meta: NonNullable<PositionsResponse['data']>['meta'] | null;
}

function mapPosition(row: PositionRow) {
  const pairLabel = `${row.token0.symbol}/${row.token1.symbol}`;

  return {
    tokenId: row.marketId,
    pool: row.marketId,
    pairLabel,
    token0Symbol: row.token0.symbol,
    token1Symbol: row.token1.symbol,
    status: (row.category === 'Inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
    tvlUsd: row.tvlUsd,
    accruedFeesUsd: row.unclaimedFeesUsd,
    realizedFeesUsd: 0,
    rflrAmount: 0,
    rflrUsd: row.incentivesUsd,
  };
}

async function loadWalletSummary(wallet: string, signal?: AbortSignal): Promise<WalletSummaryResponse> {
  const response = await fetchPositions(wallet, { signal });
  const positions = response.data?.positions ?? [];
  const summary = response.data?.summary ?? computeSummary(positions);

  return {
    wallet,
    totals: {
      tvlUsd: summary.tvlUsd,
      feesRealizedUsd: 0,
      rewardsUsd: summary.rewardsUsd,
      unclaimedFeesUsd: summary.fees24hUsd,
      rflrAmount: 0,
      rflrUsd: summary.incentivesUsd,
      capitalInvestedUsd: 0,
      roiPct: 0,
    },
    positions: positions.map(mapPosition),
    capitalTimeline: [],
    recentActivity: [],
    meta: response.data?.meta ?? null,
  };
}

export function useWalletSummary(wallet: string | undefined) {
  return useQuery({
    queryKey: ['wallet-summary', wallet],
    queryFn: ({ signal }) => {
      if (!wallet) {
        throw new Error('Wallet address is required');
      }
      return loadWalletSummary(wallet, signal);
    },
    enabled: !!wallet,
    staleTime: 30_000,
  });
}

