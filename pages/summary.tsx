// TODO: In the future, make formatting i18n/locale aware
'use client';

import React from 'react';
import dayjs from 'dayjs';
import Header from '@/components/Header';
import { GroupedPoolsList } from '@/components/GroupedPoolsList';
import { useWalletSummary } from '@/hooks/useWalletSummary';
import { formatUsd, formatPercent } from '@/utils/format';

// API position type from wallet/summary endpoint
interface ApiPosition {
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
}

export default function SummaryPage() {
  const [walletAddress, setWalletAddress] = React.useState<string>('');
  const { data, isLoading, isError, refetch } = useWalletSummary(walletAddress);

  // Check if wallet is already connected on mount
  React.useEffect(() => {
    const checkWallet = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
          if (accounts && accounts.length > 0) {
            console.log('[SUMMARY] Found existing wallet connection:', accounts[0]);
            setWalletAddress(accounts[0]);
          }
        } catch (error) {
          console.error('[SUMMARY] Error checking wallet:', error);
        }
      }
    };
    checkWallet();
  }, []);

  // Handle wallet connection
  const handleWalletConnected = (address: string) => {
    console.log('[SUMMARY] Wallet connected:', address);
    setWalletAddress(address);
  };

  // Handle wallet disconnection
  const handleWalletDisconnected = () => {
    console.log('[SUMMARY] Wallet disconnected');
    setWalletAddress('');
  };

  // Debug: Log wallet address changes
  React.useEffect(() => {
    console.log('[SUMMARY] Wallet address state:', walletAddress);
  }, [walletAddress]);

  // Wallet not connected
  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-enosys-bg">
        <Header 
          showTabs={false}
          onWalletConnected={handleWalletConnected}
          onWalletDisconnected={handleWalletDisconnected}
        />
        <div className="w-full max-w-[1200px] mx-auto px-4 py-8">
          <div className="bg-enosys-card rounded-lg p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-4">Connect Your Wallet</h2>
            <p className="text-enosys-subtext mb-6">
              Please connect your wallet to view your portfolio summary.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-enosys-bg">
        <Header 
          showTabs={false}
          onWalletConnected={handleWalletConnected}
          onWalletDisconnected={handleWalletDisconnected}
        />
        <div className="w-full max-w-[1200px] mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-enosys-card rounded-lg p-6 animate-pulse">
                <div className="h-4 bg-enosys-subcard rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-enosys-subcard rounded w-3/4"></div>
              </div>
            ))}
          </div>
          <div className="bg-enosys-card rounded-lg p-6 animate-pulse mb-8">
            <div className="h-6 bg-enosys-subcard rounded w-1/4 mb-4"></div>
            <div className="h-64 bg-enosys-subcard rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !data) {
    return (
      <div className="min-h-screen bg-enosys-bg">
        <Header 
          showTabs={false}
          onWalletConnected={handleWalletConnected}
          onWalletDisconnected={handleWalletDisconnected}
        />
        <div className="w-full max-w-[1200px] mx-auto px-4 py-8">
          <div className="bg-enosys-card rounded-lg p-8 text-center">
            <h2 className="text-xl font-bold text-red-500 mb-4">Error Loading Summary</h2>
            <p className="text-enosys-subtext mb-6">
              Failed to fetch your portfolio data. Please try again.
            </p>
            <button
              onClick={() => refetch()}
              className="px-6 py-2 bg-enosys-blue hover:bg-enosys-blueHover text-white rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Data state
  const { totals, positions, recentActivity } = data;

  // Convert API positions to GroupedPoolsList format
  const poolsData = positions
    .filter((pos: ApiPosition) => 
      // Show all active pools, and inactive pools with rewards
      pos.status === 'active' || (pos.rflrAmount && pos.rflrAmount > 0)
    )
    .map((pos: ApiPosition) => {
      const token0Symbol = pos.token0Symbol || 'TOKEN0';
      const token1Symbol = pos.token1Symbol || 'TOKEN1';
      const pairLabel = pos.pairLabel || `${token0Symbol}/${token1Symbol}`;
      
      // Calculate total earnings (fees + RFLR)
      const earningsUsd = (pos.realizedFeesUsd || 0) + (pos.accruedFeesUsd || 0);
      
      return {
        tokenId: pos.tokenId,
        pairLabel,
        token0Symbol,
        token1Symbol,
        status: pos.status,
        tvlUsd: pos.tvlUsd || 0,
        tvlAtMintUsd: undefined, // TODO: Get from API
        earningsUsd,
        unclaimedFeesUsd: pos.accruedFeesUsd || 0,
        fee0: undefined, // TODO: Get from API
        fee1: undefined, // TODO: Get from API
        rflrAmount: pos.rflrAmount || 0,
        rflrUsd: pos.rflrUsd || 0,
        roi: undefined, // TODO: Calculate ROI
      };
    });

  return (
    <div className="min-h-screen bg-enosys-bg">
      <Header 
        showTabs={false}
        onWalletConnected={handleWalletConnected}
        onWalletDisconnected={handleWalletDisconnected}
      />
      <div className="w-full max-w-[1200px] mx-auto px-4 py-8">
        
        {/* Top Row Cards - Totals */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Total TVL */}
          <div className="bg-enosys-card rounded-lg p-6">
            <div className="text-enosys-subtext text-sm mb-2">Total TVL</div>
            <div className="text-white text-2xl font-bold mb-1">
              {formatUsd(totals.tvlUsd)}
            </div>
            <div className="text-enosys-subtext text-xs">
              Current value in pools
            </div>
          </div>

          {/* Realized Fees */}
          <div className="bg-enosys-card rounded-lg p-6">
            <div className="text-enosys-subtext text-sm mb-2">Realized Fees</div>
            <div className="text-white text-2xl font-bold mb-1">
              {formatUsd(totals.feesRealizedUsd)}
            </div>
            <div className="text-enosys-subtext text-xs">
              From collect events
            </div>
          </div>

          {/* Total Rewards */}
          <div className="bg-enosys-card rounded-lg p-6">
            <div className="text-enosys-subtext text-sm mb-2">Total Rewards</div>
            <div className="text-white text-2xl font-bold mb-1">
              {formatUsd(totals.rewardsUsd)}
            </div>
            <div className="text-enosys-subtext text-xs">
              RFLR rewards
            </div>
          </div>

          {/* ROI */}
          <div className="bg-enosys-card rounded-lg p-6">
            <div className="text-enosys-subtext text-sm mb-2">ROI</div>
            <div className={`text-2xl font-bold mb-1 ${totals.roiPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totals.roiPct >= 0 ? '+' : ''}{formatPercent(totals.roiPct)}
            </div>
            <div className="text-enosys-subtext text-xs">
              Return on investment
            </div>
          </div>
        </div>

        {/* Capital Timeline Section */}
        <div className="bg-enosys-card rounded-lg p-6 mb-8">
          <h2 className="text-white text-lg font-bold mb-4">Capital Timeline</h2>
          {/* TODO: Add Recharts line chart with capitalTimeline data */}
          {/* TODO: Add time range filters (7d, 30d, 90d, all) */}
          <div className="h-64 flex items-center justify-center bg-enosys-subcard rounded-lg">
            <p className="text-enosys-subtext">Chart Coming Soon</p>
          </div>
        </div>

        {/* Grouped Pools by Pairing */}
        <div className="mb-8">
          <h2 className="text-white text-lg font-bold mb-4">Your Pools</h2>
          <GroupedPoolsList pools={poolsData} />
        </div>

        {/* Recent Activity Section */}
        <div className="bg-enosys-card rounded-lg p-6">
          <h2 className="text-white text-lg font-bold mb-4">Recent Activity</h2>
          {/* TODO: Add event type icons (mint, collect, burn, swap) */}
          {/* TODO: Add pagination for long lists */}
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-enosys-subtext text-center py-8">No recent activity</p>
            ) : (
              recentActivity.map((activity, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-enosys-subcard rounded-lg p-4"
                >
                  <div>
                    <div className="text-white font-medium">
                      {activity.label.charAt(0).toUpperCase() + activity.label.slice(1).toLowerCase()}
                    </div>
                    <div className="text-enosys-subtext text-sm">
                      {dayjs.unix(activity.timestamp).format('DD MMM YYYY HH:mm')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-white font-medium">
                      {formatUsd(activity.amountUsd)}
                    </div>
                    <a
                      href={`https://flarescan.com/tx/${activity.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-enosys-blue hover:text-enosys-blueHover text-sm transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View →
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
