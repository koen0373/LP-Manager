import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { PoolDetailVM } from './types';
import Header from '@/components/Header';
import { WaterSpinner } from '@/components/WaterSpinner';
import { formatDateShort } from '@/lib/formatDate';

// Dynamic import - pure client-side (no SSR)
const EChartsRangeChart = dynamic(
  () => import('./EChartsRangeChart'),
  { 
    ssr: false,
    loading: () => (
      <div className="bg-liqui-card rounded-lg border border-liqui-border p-6 h-[400px] flex items-center justify-center">
        <span className="text-liqui-subtext">Loading chart...</span>
      </div>
    )
  }
);

interface PoolPairDetailProps {
  vm: PoolDetailVM;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  onClaimFees?: () => void;
  activeCount?: number;
  inactiveCount?: number;
  onTabChange?: (tab: 'active' | 'inactive' | 'all') => void;
  activeTab?: 'active' | 'inactive' | 'all';
  onWalletConnected?: (address: string) => void;
  onWalletDisconnected?: () => void;
}

function getTokenIconPath(symbol?: string): string {
  if (!symbol) return '/icons/default-token.webp';
  
  const iconMap: Record<string, string> = {
    'WFLR': '/icons/flr.webp',
    'FLR': '/icons/flr.webp',
    'USD₮0': '/icons/usd0.webp',
    'eUSDT': '/icons/eusdt.webp',
    'USDT': '/icons/eusdt.webp',
    'FXRP': '/icons/fxrp.webp',
    'APS': '/icons/aps.webp',
    'RFLR': '/icons/flr.webp',
  };
  
  return iconMap[symbol] || '/icons/default-token.webp';
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAmount(value: number, decimals?: number): string {
  // Auto-determine decimals based on value size if not specified
  if (decimals === undefined) {
    if (value === 0) return '0';
    if (value >= 1000) decimals = 2;
    else if (value >= 1) decimals = 4;
    else if (value >= 0.01) decimals = 5; // Extra decimaal voor FLR prijzen (0.01xxx)
    else if (value >= 0.0001) decimals = 6;
    else decimals = 8;
  }
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Math.min(2, decimals),
    maximumFractionDigits: decimals,
  }).format(value);
}

export function PoolPairDetail({
  vm,
  loading = false,
  error,
  onRefresh,
  onClaimFees,
  activeCount = 0, // eslint-disable-line @typescript-eslint/no-unused-vars
  inactiveCount = 0, // eslint-disable-line @typescript-eslint/no-unused-vars
  onTabChange = () => {}, // eslint-disable-line @typescript-eslint/no-unused-vars
  activeTab = 'active' as const, // eslint-disable-line @typescript-eslint/no-unused-vars
  onWalletConnected,
  onWalletDisconnected,
}: PoolPairDetailProps) {
  if (loading) {
    return (
      <div className="min-h-screen text-white">
        <Header currentPage="pools"
          showTabs={false}
          onWalletConnected={onWalletConnected}
          onWalletDisconnected={onWalletDisconnected}
        />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
          <WaterSpinner size="lg" text="Loading pool data..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen text-white">
        <Header currentPage="pools"
          showTabs={false}
          onWalletConnected={onWalletConnected}
          onWalletDisconnected={onWalletDisconnected}
        />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
            <p className="text-red-300">{error}</p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="mt-4 px-4 py-2 bg-liqui-primary text-white rounded hover:bg-liqui-blueHover"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      {/* Anthracite overlay (85% opacity) over water background */}
      <div className="fixed inset-0 bg-[#0D0F13] opacity-85 pointer-events-none" style={{ zIndex: 1 }}></div>
      <div className="relative" style={{ zIndex: 2 }}>
      <Header currentPage="pools"
        showTabs={false}
        onWalletConnected={onWalletConnected}
        onWalletDisconnected={onWalletDisconnected}
      />
      
      <div className="container mx-auto px-4 py-8">

        {/* Pool Detail Header */}
        <div className="card rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Pool Detail</h1>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${vm.range?.inRange ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm text-liqui-subtext">
                {vm.range?.inRange ? 'In Range' : 'Out of Range'}
              </span>
            </div>
          </div>
          
          {/* Token Icons and Pair */}
          <div className="flex items-center gap-8 mb-4">
            <div className="flex items-center -space-x-2">
              <Image
                src={getTokenIconPath(vm.token0?.symbol)}
                alt={vm.token0?.symbol || 'Token 0'}
                width={32}
                height={32}
                className="rounded-full"
              />
              <Image
                src={getTokenIconPath(vm.token1?.symbol)}
                alt={vm.token1?.symbol || 'Token 1'}
                width={32}
                height={32}
                className="rounded-full"
              />
            </div>
            <div className="text-lg font-medium">
              {vm.token0?.symbol}/{vm.token1?.symbol}
            </div>
          </div>
          
          {/* ID and Contract */}
          <div className="flex items-center gap-4 text-sm text-liqui-subtext">
            <span>ID #{vm.poolId}</span>
            <span>•</span>
            <span>{vm.feeTierBps / 10000}%</span>
            {vm.poolAddress && (
              <>
                <span>•</span>
                <Link
                  href={`https://flarescan.com/address/${vm.poolAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-liqui-blue hover:text-liqui-blueHover flex items-center gap-1"
                >
                  Contract
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Liquidity */}
          <div className="card rounded-xl p-6 hover:ring-1 hover:ring-liqui-aqua/40 transition">
            <h2 className="text-mist text-sm font-semibold uppercase tracking-wide mb-4">Liquidity</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Image
                    src={getTokenIconPath(vm.token0?.symbol)}
                    alt={vm.token0?.symbol || 'Token 0'}
                    width={16}
                    height={16}
                    className="rounded-full"
                  />
                  <span className="text-liqui-subtext">{vm.token0?.symbol}</span>
                </div>
                <span className="text-white">{formatAmount(vm.tvl.amount0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Image
                    src={getTokenIconPath(vm.token1?.symbol)}
                    alt={vm.token1?.symbol || 'Token 1'}
                    width={16}
                    height={16}
                    className="rounded-full"
                  />
                  <span className="text-liqui-subtext">{vm.token1?.symbol}</span>
                </div>
                <span className="text-white">{formatAmount(vm.tvl.amount1)}</span>
              </div>
              <div className="pt-3 border-t border-liqui-border">
                <div className="flex justify-between items-center">
                  <span className="text-liqui-subtext">Total Value</span>
                  <span className="text-white font-medium">{formatUsd(vm.tvl.tvlUsd)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rewards */}
          <div className="card rounded-xl p-6 hover:ring-1 hover:ring-liqui-aqua/40 transition">
            <h2 className="text-mist text-sm font-semibold uppercase tracking-wide mb-4">Rewards</h2>
            <div className="space-y-4">
              {/* Total Rewards */}
              <div className="pb-3 border-b border-liqui-border">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-liqui-subtext font-medium">Total Rewards</span>
                  <span className="text-white font-bold text-lg">{formatUsd(vm.rewards.totalUsd)}</span>
                </div>
              </div>
              
              {/* Unclaimed Fees */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-liqui-subtext">Unclaimed fees:</span>
                  <span className="text-white">{formatUsd(vm.rewards.feesUsd)}</span>
                </div>
                <div className="pl-4 space-y-1 text-sm">
                  {vm.rewards.feesToken0 > 0 && (
                    <div className="text-liqui-subtext">
                      {formatAmount(vm.rewards.feesToken0)} {vm.token0?.symbol}
                    </div>
                  )}
                  {vm.rewards.feesToken1 > 0 && (
                    <div className="text-liqui-subtext">
                      {formatAmount(vm.rewards.feesToken1)} {vm.token1?.symbol}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Incentives (RFLR) */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-liqui-subtext">Incentives:</span>
                  <span className="text-white">{formatUsd(vm.rewards.rflrUsd)}</span>
                </div>
                <div className="pl-4 text-sm text-liqui-subtext">
                  {formatAmount(vm.rewards.rflr)} RFLR
                </div>
              </div>
              
              {onClaimFees && (
                <button
                  onClick={onClaimFees}
                  className="w-full mt-3 px-4 py-2 bg-liqui-primary text-white rounded hover:bg-liqui-blueHover font-medium"
                >
                  Claim Rewards
                </button>
              )}
            </div>
          </div>

          {/* Range */}
          <div className="card rounded-xl p-6 hover:ring-1 hover:ring-liqui-aqua/40 transition">
            <h2 className="text-mist text-sm font-semibold uppercase tracking-wide mb-4">Range</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-liqui-subtext">Min Price</span>
                <span className="text-white">
                  {vm.range?.min && !isNaN(vm.range.min) ? formatAmount(vm.range.min) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-liqui-subtext">Max Price</span>
                <span className="text-white">
                  {vm.range?.max && !isNaN(vm.range.max) ? formatAmount(vm.range.max) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-liqui-subtext">Current Price</span>
                <span className="text-white">
                  {vm.range?.current && !isNaN(vm.range.current) ? formatAmount(vm.range.current) : 'N/A'}
                </span>
              </div>
              <div className="pt-3 border-t border-liqui-border">
                <div className="flex justify-between items-center">
                  <span className="text-liqui-subtext">Status</span>
                  <span className={`font-medium ${vm.range?.inRange ? 'text-green-400' : 'text-red-400'}`}>
                    {vm.range?.inRange ? 'In Range' : 'Out of Range'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Range & Price Chart */}
        <div className="mt-6">
          <EChartsRangeChart
            priceHistory={vm.priceHistory}
            minPrice={vm.range.min}
            maxPrice={vm.range.max}
            currentPrice={vm.range.current}
          />
        </div>

        {/* Pool Earnings */}
        <div className="mt-6 card rounded-xl p-6 hover:ring-1 hover:ring-liqui-aqua/40 transition">
          <h2 className="text-mist text-sm font-semibold uppercase tracking-wide mb-6">Pool Earnings</h2>
          
          {/* Row 1: TVL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <div className="text-liqui-subtext text-sm mb-1">Initial TVL</div>
              <div className="text-white text-lg font-medium">{formatUsd(vm.funding.usdValue)}</div>
            </div>
            <div>
              <div className="text-liqui-subtext text-sm mb-1">Actual TVL</div>
              <div className="text-white text-lg font-medium">{formatUsd(vm.tvl.tvlUsd)}</div>
            </div>
          </div>

          {/* Row 2: Fees (Collected left, Uncollected right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <div className="text-liqui-subtext text-sm mb-1">Collected Fees</div>
              <div className="text-white text-lg font-medium">{formatUsd(vm.rewards.claimedUsd || 0)}</div>
            </div>
            <div>
              <div className="text-liqui-subtext text-sm mb-1">Uncollected Fees</div>
              <div className="text-white text-lg font-medium">{formatUsd(vm.rewards.totalUsd - (vm.rewards.rflrUsd || 0))}</div>
            </div>
          </div>

          {/* Row 3: Incentives (Collected left, Uncollected right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <div className="text-liqui-subtext text-sm mb-1">Collected Incentives</div>
              <div className="text-white text-lg font-medium">$0.00</div>
              <div className="text-liqui-subtext text-xs mt-1">RFLR claimed via Flare Portal</div>
            </div>
            <div>
              <div className="text-liqui-subtext text-sm mb-1">Uncollected Incentives</div>
              <div className="text-white text-lg font-medium">
                {vm.rewards.rflr ? `${formatAmount(vm.rewards.rflr)} RFLR (${formatUsd(vm.rewards.rflrUsd || 0)})` : '$0.00'}
              </div>
              <div className="text-liqui-subtext text-xs mt-1">Claimable via Flare Portal end of month</div>
            </div>
          </div>

          {/* Row 4: APY */}
          <div className="mb-6">
            <div className="text-liqui-subtext text-sm mb-2">APY</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-liqui-subtext text-xs mb-1">24h</div>
                <div className="text-white font-medium">
                  {vm.tvl.apy24h !== undefined ? `${vm.tvl.apy24h.toFixed(2)}%` : '--%'}
                </div>
              </div>
              <div>
                <div className="text-liqui-subtext text-xs mb-1">7d</div>
                <div className="text-white font-medium">
                  {vm.tvl.apy7d !== undefined ? `${vm.tvl.apy7d.toFixed(2)}%` : '--%'}
                </div>
              </div>
              <div>
                <div className="text-liqui-subtext text-xs mb-1">1M</div>
                <div className="text-white font-medium">
                  {vm.tvl.apy1m !== undefined ? `${vm.tvl.apy1m.toFixed(2)}%` : '--%'}
                </div>
              </div>
              <div>
                <div className="text-liqui-subtext text-xs mb-1">All-Time</div>
                <div className="text-white font-medium">
                  {vm.tvl.apyAllTime !== undefined ? `${vm.tvl.apyAllTime.toFixed(2)}%` : '--%'}
                </div>
              </div>
            </div>
          </div>

          {/* Row 5: IL Loss */}
          <div>
            <div className="text-liqui-subtext text-sm mb-1">Impermanent Loss</div>
            <div className={`text-lg font-medium ${
              vm.il.ilPct >= 0 ? 'text-green-400' : 
              vm.il.ilPct > -1 ? 'text-yellow-400' : 
              vm.il.ilPct > -5 ? 'text-orange-400' : 
              'text-red-400'
            }`}>
              {vm.il.ilPct !== undefined && isFinite(vm.il.ilPct) 
                ? vm.il.ilPct >= 0 
                  ? `No loss (+${vm.il.ilPct.toFixed(2)}%)`
                  : `${vm.il.ilPct.toFixed(2)}%`
                : '--%'}
            </div>
            <div className="text-liqui-subtext text-xs mt-1">
              {vm.il.hodlValueUsd > 0 
                ? `Hold value: ${formatUsd(vm.il.hodlValueUsd)} vs LP value: ${formatUsd(vm.il.lpValueUsd)}`
                : 'Compared to holding tokens'}
            </div>
          </div>
        </div>

        {/* Activity */}
        <div className="mt-6 card rounded-xl p-6 hover:ring-1 hover:ring-liqui-aqua/40 transition">
          <h2 className="text-mist text-sm font-semibold uppercase tracking-wide mb-4">
            Recent Activity
            <span className="ml-2 text-xs text-mist font-normal lowercase">
              ({vm.activity?.length || 0} events)
            </span>
          </h2>
          {vm.activity && vm.activity.length > 0 ? (
            <div className="space-y-3">
              {vm.activity.slice(0, 5).map((entry) => (
                <div key={entry.id} className="py-3 border-b border-liqui-border last:border-b-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-white font-medium">{entry.title}</div>
                      {entry.subtitle && (
                        <div className="text-liqui-subtext text-sm">{entry.subtitle}</div>
                      )}
                    </div>
                    <div className="text-liqui-subtext text-sm">
                      {formatDateShort(entry.timestamp)}
                    </div>
                  </div>
                  {entry.metrics && entry.metrics.length > 0 && (
                    <div className="flex gap-4 mt-2">
                      {entry.metrics.map((metric, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="text-liqui-subtext">{metric.label}: </span>
                          <span className={`font-medium ${
                            metric.accent === 'positive' ? 'text-green-400' :
                            metric.accent === 'negative' ? 'text-red-400' :
                            'text-white'
                          }`}>
                            {metric.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-liqui-subtext text-center py-8">
              No activity recorded yet. Events will appear here once the position is synced.
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}