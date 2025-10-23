import { useQuery } from '@tanstack/react-query';

// Export the response type for use in components
export interface WalletSummaryResponse {
  wallet: string;
  totals: {
    tvlUsd: number;
    feesRealizedUsd: number;
    rewardsUsd: number;
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
}

// Fetcher function
async function fetchWalletSummary(wallet: string): Promise<WalletSummaryResponse> {
  console.log('[useWalletSummary] Fetching summary for wallet:', wallet);
  const response = await fetch(`/api/wallet/summary?address=${wallet}`);

  if (!response.ok) {
    console.error('[useWalletSummary] Failed to fetch:', response.status);
    throw new Error(`Failed to fetch wallet summary: ${response.status}`);
  }

  const data = await response.json();
  console.log('[useWalletSummary] Received data:', data);
  
  // TODO: Add data validation/transformation here
  // - Validate response structure matches WalletSummaryResponse type
  // - Transform/normalize data if needed (e.g., date parsing, number rounding)
  // - Add computed fields (e.g., total portfolio value, % allocation per position)
  
  return data;
}

/**
 * React Query hook for fetching wallet summary data
 * 
 * @param wallet - The wallet address to fetch summary for
 * @returns Query result with data, loading, error states and refetch function
 * 
 * TODO: Error handling improvements
 * - Add retry logic for network failures
 * - Handle specific error cases (404, 500, rate limiting)
 * - Add error boundary support
 * - Show user-friendly error messages
 * 
 * TODO: Data transformation
 * - Parse timestamps to Date objects
 * - Sort positions by TVL or status
 * - Calculate additional metrics (30d performance, best/worst positions)
 * - Add caching strategy for historical data
 */
export function useWalletSummary(wallet: string | undefined) {
  return useQuery({
    queryKey: ['wallet-summary', wallet],
    queryFn: () => {
      if (!wallet) {
        throw new Error('Wallet address is required');
      }
      return fetchWalletSummary(wallet);
    },
    enabled: !!wallet, // Only run query if wallet exists
    staleTime: 30_000, // 30 seconds - data stays fresh for this duration
    // TODO: Consider adding these options:
    // refetchOnWindowFocus: true, // Refetch when user returns to tab
    // refetchInterval: 60_000, // Auto-refetch every minute for live updates
    // retry: 3, // Retry failed requests 3 times
    // retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
