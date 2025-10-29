'use client';

import React from 'react';
import Image from 'next/image';
import { useAccount, useConnect } from 'wagmi';
import { TokenIcon } from '@/components/TokenIcon';
import { formatUsd } from '@/utils/format';
import RangeBand, { getRangeStatus } from '@/components/pools/PoolRangeIndicator';
import { calcApr24h } from '@/lib/metrics';

type ConnectWalletModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type WalletOption = {
  id: string;
  name: string;
  iconUrl: string;
  connectorId?: string;
  href?: string;
  disabled?: boolean;
};

type SortKey = 'tvl' | 'fees' | 'incentives' | 'apr';

type SortOption = {
  key: SortKey;
  label: string;
};

type PoolSummary = {
  tokenId: string;
  pair: string;
  provider: string;
  poolId: string;
  feeTier: string;
  feeTierBps?: number;
  tvlUsd: number;
  feesUsd: number;
  dailyFeesUsd: number;
  incentivesUsd: number;
  dailyIncentivesUsd: number;
  rangeMin?: number;
  rangeMax?: number;
  currentPrice?: number;
  token0PriceUsd?: number;
  status: 'in' | 'near' | 'out';
  apr: number;
  token0Symbol: string;
  token1Symbol: string;
  token0Icon?: string;
  token1Icon?: string;
};

type RemoteTokenMeta = {
  symbol?: string;
  iconSrc?: string;
  priceUsd?: number | string;
};

type RemotePosition = {
  id?: string | number;
  tokenId?: string | number;
  poolId?: string | number;
  provider?: string;
  dexName?: string;
  token0Symbol?: string;
  token1Symbol?: string;
  token0Icon?: string;
  token1Icon?: string;
  token0?: RemoteTokenMeta | null;
  token1?: RemoteTokenMeta | null;
  lowerPrice?: number | string;
  rangeMin?: number | string;
  upperPrice?: number | string;
  rangeMax?: number | string;
  currentPrice?: number | string;
  feeTier?: string | number;
  feeTierBps?: number | string;
  tvlUsd?: number | string;
  unclaimedFeesUsd?: number | string;
  rewardsUsd?: number | string;
  feesUsd?: number | string;
  dailyFeesUsd?: number | string;
  fees24hUsd?: number | string;
  rflrUsd?: number | string;
  incentivesUsd?: number | string;
  incentives24hUsd?: number | string;
  dailyIncentivesUsd?: number | string;
  rflrRewards24hUsd?: number | string;
  apr24hPct?: number | string;
  token0PriceUsd?: number | string;
};

type WalletWindow = Window &
  typeof globalThis & {
    ethereum?: {
      isMetaMask?: boolean;
      isRabby?: boolean;
      isBraveWallet?: boolean;
    };
    phantom?: {
      ethereum?: unknown;
    };
    okxwallet?: unknown;
  };

const isDev = process.env.NODE_ENV !== 'production';

const WALLETS: WalletOption[] = [
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    iconUrl: '/icons/wallet connect icon.webp',
    connectorId: 'walletConnect',
  },
  {
    id: 'bifrost',
    name: 'Bifrost',
    iconUrl: '/icons/bifrost.webp',
    href: 'https://www.bifrostwallet.com/',
  },
  {
    id: 'metamask',
    name: 'MetaMask',
    iconUrl: '/icons/Metamask icon.svg',
    connectorId: 'injected',
  },
  {
    id: 'phantom',
    name: 'Phantom',
    iconUrl: '/icons/phantom icon.png',
    connectorId: 'injected',
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    iconUrl: '/icons/OKX icon.webp',
    connectorId: 'injected',
  },
  {
    id: 'rabby',
    name: 'Rabby',
    iconUrl: '/icons/rabby.webp',
    connectorId: 'injected',
  },
  {
    id: 'brave',
    name: 'Brave Wallet',
    iconUrl: '/icons/brave icon.webp',
    connectorId: 'injected',
  },
];

const SORT_OPTIONS: SortOption[] = [
  { key: 'tvl', label: 'TVL' },
  { key: 'fees', label: 'Fees' },
  { key: 'incentives', label: 'Incentives' },
  { key: 'apr', label: 'APR' },
];

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function coerceString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

function feeTierToBps(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const str = coerceString(value);
  if (!str) return undefined;
  if (str.endsWith('%')) {
    const percent = Number(str.replace('%', '').trim());
    if (Number.isFinite(percent)) {
      return percent * 100;
    }
  }
  const numeric = Number(str);
  return Number.isFinite(numeric) ? numeric : undefined;
}

/**
 * Robust fee formatter that accepts multiple encodings.
 * Uniswap v3 onchain "fee" is *hundredths of a bip* (1e-6): 3000 -> 0.3%.
 * Some APIs provide bps (30 -> 0.30%), or direct pct (0.003 -> 0.3% or 0.3 -> 0.3%).
 */
function toFeePercentNumber(input: unknown): number {
  const v = Number(input ?? 0);
  if (!isFinite(v) || v <= 0) return 0;

  // Heuristics:
  // - Common Uniswap-style (hundredths of a bip): 500, 3000, 10000 -> 0.05/0.3/1.0 %
  if (v >= 500 && v <= 10000) return v / 1e4; // 3000 => 0.3

  // - True bps: 5, 30, 100 -> 0.05/0.3/1.0 %
  if (v <= 100) return v / 100;

  // - Already percent fraction (0.003) or percent number (0.3)
  if (v > 0 && v < 2) return v >= 1 ? v : v * 100; // 0.3 -> 0.3% | 1.2 -> 1.2%

  // Fallback: assume hundredths-of-bip
  return v / 1e4;
}

function formatFeeTierRobust(input: unknown): string {
  const n = toFeePercentNumber(input);
  // Show up to one decimal for typical tiers (0.3%, 1.0%), two decimals for small values (0.05%)
  const decimals = n < 0.1 ? 2 : 1;
  return `${n.toFixed(decimals)}%`;
}

function formatFeeTier(feeTier?: unknown, feeTierBps?: number): string {
  const direct = coerceString(feeTier);
  if (direct && direct !== '—') {
    // Try to parse the direct string value robustly
    return formatFeeTierRobust(direct);
  }
  if (typeof feeTierBps === 'number' && Number.isFinite(feeTierBps)) {
    return formatFeeTierRobust(feeTierBps);
  }
  return '—';
}

// Browser detection for installed wallets
function isWalletInstalled(walletId: string): boolean {
  if (typeof window === 'undefined') return false;
  const agent = window as WalletWindow;
  
  switch (walletId) {
    case 'metamask':
      return !!agent.ethereum?.isMetaMask;
    case 'phantom':
      return !!agent.phantom?.ethereum;
    case 'okx':
      return !!agent.okxwallet;
    case 'rabby':
      return !!agent.ethereum?.isRabby;
    case 'brave':
      return !!agent.ethereum?.isBraveWallet;
    default:
      return false;
  }
}

/**
 * Normalize a pool's sort value for a given key
 * Implements tolerant field mapping with fallbacks
 */
function getSortValue(position: RemotePosition, sortKey: SortKey): number {
  switch (sortKey) {
    case 'tvl':
      return coerceNumber(position.tvlUsd) ?? 0;
    
    case 'fees':
      return (
        coerceNumber(position.fees24hUsd) ??
        coerceNumber(position.unclaimedFeesUsd) ??
        0
      );
    
    case 'incentives':
      return (
        coerceNumber(position.incentives24hUsd) ??
        coerceNumber(position.incentivesUsd) ??
        coerceNumber(position.rflrUsd) ??
        0
      );
    
    case 'apr':
      return calcApr24h({
        tvlUsd: coerceNumber(position.tvlUsd),
        dailyFeesUsd:
          coerceNumber(position.dailyFeesUsd) ??
          coerceNumber(position.fees24hUsd),
        dailyIncentivesUsd:
          coerceNumber(position.dailyIncentivesUsd) ??
          coerceNumber(position.incentives24hUsd) ??
          coerceNumber(position.rflrRewards24hUsd),
      });
    
    default:
      return 0;
  }
}

export default function ConnectWalletModal({ isOpen, onClose }: ConnectWalletModalProps) {
  const { address } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const [phase, setPhase] = React.useState<'connect' | 'loading' | 'result'>('connect');
  const [sortBy, setSortBy] = React.useState<SortKey>('tvl');
  const [topPool, setTopPool] = React.useState<PoolSummary | null>(null);
  const [activeCount, setActiveCount] = React.useState(0);
  const [inactiveCount, setInactiveCount] = React.useState(0);

  React.useEffect(() => {
    if (!isOpen) {
      setPhase('connect');
      setSortBy('tvl');
      setTopPool(null);
      setActiveCount(0);
      setInactiveCount(0);
    }
  }, [isOpen]);

  React.useEffect(() => {
    async function fetchPools() {
      if (!address) return;
      
      setPhase('loading');
      
      try {
        const res = await fetch(`/api/positions?address=${address}`);
        if (!res.ok) {
          console.warn('[ConnectWalletModal] API returned', res.status);
          setPhase('result');
          return;
        }
        
        const json: unknown = await res.json();
        
        if (!Array.isArray(json)) {
          console.warn('[ConnectWalletModal] Invalid response format');
          setPhase('result');
          return;
        }
        const data: RemotePosition[] = json as RemotePosition[];
        
        // Sort by selected key and find top pool
        const sorted = data
          .filter((position) => {
            const tvl = coerceNumber(position.tvlUsd) ?? 0;
            return tvl > 0;
          })
          .sort((a, b) => {
            const aValue = getSortValue(a, sortBy);
            const bValue = getSortValue(b, sortBy);
            return bValue - aValue;
          });
        
        const top = sorted[0];
        if (top) {
          if (isDev) {
            console.log('[ConnectWalletModal] Top pool data:', top);
          }

          const token0 = top.token0 ?? undefined;
          const token1 = top.token1 ?? undefined;

          const token0Symbol = coerceString(top.token0Symbol) ?? coerceString(token0?.symbol) ?? '?';
          const token1Symbol = coerceString(top.token1Symbol) ?? coerceString(token1?.symbol) ?? '?';

          const rangeMin = coerceNumber(top.lowerPrice) ?? coerceNumber(top.rangeMin);
          const rangeMax = coerceNumber(top.upperPrice) ?? coerceNumber(top.rangeMax);

          let currentPrice = coerceNumber(top.currentPrice);
          if (currentPrice === undefined && rangeMin !== undefined && rangeMax !== undefined) {
            currentPrice = (rangeMin + rangeMax) / 2;
          }

          const status = getRangeStatus(currentPrice, rangeMin, rangeMax);
          if (isDev) {
            console.log('[ConnectWalletModal] Range data:', { rangeMin, rangeMax, currentPrice, status });
          }

          const feeTierBps = coerceNumber(top.feeTierBps) ?? feeTierToBps(top.feeTier);
          const feeTier = formatFeeTier(top.feeTier, feeTierBps);

          const tvl = coerceNumber(top.tvlUsd) ?? 0;
          const feesUsd = coerceNumber(top.unclaimedFeesUsd) ?? coerceNumber(top.feesUsd) ?? coerceNumber(top.rewardsUsd) ?? 0;
          const incentivesUsd = coerceNumber(top.rflrUsd) ?? coerceNumber(top.incentivesUsd) ?? 0;
          const dailyFeesFromApi = coerceNumber(top.dailyFeesUsd) ?? coerceNumber(top.fees24hUsd);
          const dailyFeesRaw = dailyFeesFromApi ?? (feesUsd > 0 ? feesUsd / 14 : 0);
          const dailyFeesUsd = status === 'out' ? 0 : Math.max(0, dailyFeesRaw);
          const dailyIncentivesFromApi =
            coerceNumber(top.dailyIncentivesUsd) ??
            coerceNumber(top.incentives24hUsd) ??
            coerceNumber(top.rflrRewards24hUsd);
          const dailyIncentivesRaw =
            dailyIncentivesFromApi ?? (incentivesUsd > 0 ? incentivesUsd / 14 : 0);
          const dailyIncentivesUsd = status === 'out' ? 0 : Math.max(0, dailyIncentivesRaw);
          const aprRaw = calcApr24h({
            tvlUsd: tvl,
            dailyFeesUsd,
            dailyIncentivesUsd,
          });
          const apr = Math.min(999, aprRaw);

          setTopPool({
            tokenId: String(top.id ?? top.tokenId ?? ''),
            pair: `${token0Symbol} / ${token1Symbol}`,
            provider: coerceString(top.provider) ?? coerceString(top.dexName) ?? 'Unknown',
            poolId: String(top.poolId ?? top.id ?? ''),
            feeTier,
            feeTierBps: feeTierBps ?? undefined,
            tvlUsd: tvl,
            feesUsd,
            dailyFeesUsd,
            dailyIncentivesUsd,
            incentivesUsd,
            rangeMin: rangeMin,
            rangeMax: rangeMax,
            currentPrice: currentPrice,
            token0PriceUsd: coerceNumber(top.token0PriceUsd) ?? coerceNumber(token0?.priceUsd),
            status,
            apr,
            token0Symbol,
            token1Symbol,
            token0Icon: coerceString(top.token0Icon) ?? coerceString(token0?.iconSrc),
            token1Icon: coerceString(top.token1Icon) ?? coerceString(token1?.iconSrc),
          });
        }
        
        // Count active pools (TVL > 0 or has fees)
        const active = data.filter((position) => {
          const tvl = coerceNumber(position.tvlUsd) ?? 0;
          const fees =
            coerceNumber(position.unclaimedFeesUsd) ??
            coerceNumber(position.rewardsUsd) ??
            coerceNumber(position.feesUsd) ??
            0;
          return tvl > 0 || fees > 0;
        }).length;
        
        const inactive = data.length - active;
        setActiveCount(active);
        setInactiveCount(inactive);
        setPhase('result');
      } catch (error) {
        console.error('[ConnectWalletModal] Failed to fetch pools', error);
        // Show result phase anyway (empty state)
        setPhase('result');
      }
    }
    
    void fetchPools();
  }, [address, sortBy]);

  async function handleConnect(connectorId: string) {
    const connector = connectors.find((c) => c.id === connectorId);
    if (!connector) return;
    try {
      await connect({ connector });
    } catch (error) {
      console.error('[ConnectWalletModal] Failed to connect', error);
    }
  }

  function getSortLabel(key: SortKey): string {
    switch (key) {
      case 'tvl':
        return 'TVL';
      case 'fees':
        return 'Fees';
      case 'incentives':
        return 'Incentives';
      case 'apr':
        return '24h APR';
      default:
        return 'TVL';
    }
  }

  // Handle keyboard navigation for segmented control
  function handleSegmentedKeyDown(e: React.KeyboardEvent, currentIndex: number) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const direction = e.key === 'ArrowLeft' ? -1 : 1;
      const newIndex = (currentIndex + direction + SORT_OPTIONS.length) % SORT_OPTIONS.length;
      setSortBy(SORT_OPTIONS[newIndex].key);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070C]/85 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[rgba(10,15,26,0.95)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="font-brand text-lg font-semibold text-white">
            {phase === 'connect' ? 'Connect Wallet' : 'Your Pools'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 transition hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          {phase === 'connect' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {WALLETS.map((wallet) => {
                  if (wallet.href) {
                    return (
                      <a
                        key={wallet.id}
                        href={wallet.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-[#3B82F6]/30 hover:bg-[#3B82F6]/5"
                      >
                        <Image
                          src={wallet.iconUrl}
                          alt={wallet.name}
                          width={40}
                          height={40}
                          className="rounded-lg"
                        />
                        <span className="text-xs font-semibold text-white">{wallet.name}</span>
                      </a>
                    );
                  }

                  if (wallet.disabled) {
                    return (
                      <div
                        key={wallet.id}
                        className="flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-white/[0.01] p-4 opacity-40"
                      >
                        <Image
                          src={wallet.iconUrl}
                          alt={wallet.name}
                          width={40}
                          height={40}
                          className="rounded-lg opacity-50"
                        />
                        <span className="text-xs font-semibold text-white/60">{wallet.name}</span>
                      </div>
                    );
                  }

              const connector = connectors.find((c) => c.id === wallet.connectorId);
              const available = !!connector && !isPending;
              const installed = isWalletInstalled(wallet.id);

              return (
                <button
                  key={wallet.id}
                  type="button"
                  disabled={!available}
                  onClick={() => wallet.connectorId && handleConnect(wallet.connectorId)}
                  className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 transition ${
                    available
                      ? 'border-white/10 bg-white/[0.03] hover:border-[#3B82F6]/30 hover:bg-[#3B82F6]/5'
                      : 'border-white/5 bg-white/[0.01] opacity-40'
                  }`}
                >
                  {installed && (
                    <span className="absolute right-2 top-2 rounded-md bg-green-500/20 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-green-400">
                      Installed
                    </span>
                  )}
                  <Image
                    src={wallet.iconUrl}
                    alt={wallet.name}
                    width={40}
                    height={40}
                    className="rounded-lg"
                  />
                  <span className="text-xs font-semibold text-white">{wallet.name}</span>
                </button>
              );
                })}
              </div>

              <p className="mt-4 text-center font-ui text-xs text-[#9CA3AF]">
                Read-only access. No approvals needed.
              </p>
            </>
          )}

          {phase === 'loading' && (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#3B82F6]" />
              <p className="font-ui text-sm text-white">Scanning your pools...</p>
            </div>
          )}

          {phase === 'result' && (
            <div className="space-y-4">
              {/* Compact header: title + segmented control (desktop) / select (mobile) */}
              <div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {/* Title */}
                  <h3 className="font-ui text-xs font-semibold uppercase tracking-wide text-white">
                    Choose your free pool
                  </h3>

                  {/* Desktop: Segmented control */}
                  <div
                    role="tablist"
                    aria-label="Sort pools by"
                    className="hidden items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1 sm:flex"
                    aria-live="polite"
                  >
                    {SORT_OPTIONS.map((option, index) => (
                      <button
                        key={option.key}
                        type="button"
                        role="tab"
                        aria-selected={sortBy === option.key}
                        aria-label={`Sort by ${option.label}`}
                        onClick={() => setSortBy(option.key)}
                        onKeyDown={(e) => handleSegmentedKeyDown(e, index)}
                        className={`rounded px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-wide transition focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-1 focus:ring-offset-[rgba(10,15,26,0.95)] ${
                          sortBy === option.key
                            ? 'bg-[#3B82F6] text-white shadow-sm'
                            : 'text-[#9CA3AF] hover:text-white'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {/* Mobile: Select dropdown */}
                  <div className="sm:hidden">
                    <label htmlFor="sort-select" className="sr-only">
                      Sort by
                    </label>
                    <select
                      id="sort-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortKey)}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 font-ui text-xs font-semibold uppercase tracking-wide text-white focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      aria-label="Sort pools by"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key} className="bg-[#0A0F1A] text-white">
                          Sort by {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Helper text (directly under, compact spacing) */}
                <p className="mt-2 font-ui text-xs leading-tight text-[#9CA3AF]">
                  Choose your free pool to try LiquiLab.
                </p>
              </div>

              {topPool ? (
                <>
                  <div className="rounded-xl border border-[#3B82F6]/20 bg-[#3B82F6]/5 p-4">
                    <p className="mb-3 font-ui text-xs uppercase tracking-wide text-[#3B82F6]">
                      Your top pool (by {getSortLabel(sortBy)}) — Free to follow
                    </p>
                    
                    {/* Row 1: Icons + Pool Pair + Pair Subtitle */}
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex items-center -space-x-2">
                        {topPool.token0Icon ? (
                          <Image
                            src={topPool.token0Icon}
                            alt={topPool.token0Symbol}
                            width={28}
                            height={28}
                            className="rounded-full border border-white/10"
                          />
                        ) : (
                          <TokenIcon symbol={topPool.token0Symbol} size={28} />
                        )}
                        {topPool.token1Icon ? (
                          <Image
                            src={topPool.token1Icon}
                            alt={topPool.token1Symbol}
                            width={28}
                            height={28}
                            className="rounded-full border border-white/10"
                          />
                        ) : (
                          <TokenIcon symbol={topPool.token1Symbol} size={28} />
                        )}
                      </div>
                      <span className="font-brand text-lg font-semibold text-white">{topPool.pair}</span>
                    </div>
                    
                    {/* Provider + Pool ID + Fee Tier */}
                    <div className="mb-4 flex items-center gap-2 text-[10px] uppercase text-[#9CA3AF]/60">
                      <span>{topPool.provider}</span>
                      <span className="text-white/20">•</span>
                      <span>#{topPool.poolId}</span>
                      <span className="text-white/20">•</span>
                      <span className="font-semibold">{topPool.feeTier}</span>
                    </div>
                    
                    {/* Data row: TVL, Fees, Incentives, APR */}
                    <div className="mb-4 grid grid-cols-4 gap-3">
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-[#9CA3AF]/50">TVL</p>
                        <p className="tnum mt-1 text-[15px] font-semibold text-white">{formatUsd(topPool.tvlUsd)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-[#9CA3AF]/50">Fees</p>
                        <p className="tnum mt-1 text-[15px] font-semibold text-white">{formatUsd(topPool.feesUsd)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-[#9CA3AF]/50">Incentives</p>
                        <p className="tnum mt-1 text-[15px] font-semibold text-white">{formatUsd(topPool.incentivesUsd)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase tracking-wide text-[#9CA3AF]/50">24h APR</p>
                        <p className="tnum mt-1 text-[15px] font-semibold text-white">{topPool.apr.toFixed(1)}%</p>
                      </div>
                    </div>
                    
                    {/* RangeBand (includes current price internally) */}
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                      {topPool.rangeMin !== undefined && topPool.rangeMax !== undefined ? (
                        <div data-ll-ui="v2025-10">
                          <RangeBand
                            min={topPool.rangeMin}
                            max={topPool.rangeMax}
                            current={topPool.currentPrice}
                            status={topPool.status}
                            token0Symbol={topPool.token0Symbol}
                            token1Symbol={topPool.token1Symbol}
                          />
                        </div>
                      ) : (
                        <p className="text-center font-ui text-xs text-[#9CA3AF]">Range data unavailable</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="font-ui text-sm text-white">
                      We found <span className="font-semibold text-[#3B82F6]">{activeCount} active</span> and{' '}
                      <span className="font-semibold text-[#3B82F6]">{inactiveCount} inactive</span> pools.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = `/dashboard?trial=${topPool.tokenId}`;
                      }}
                      className="w-full rounded-xl bg-[#3B82F6] px-5 py-3 font-brand text-sm font-semibold text-white transition hover:bg-[#60A5FA] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                    >
                      Start your free trial
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = '/pricing';
                      }}
                      className="w-full rounded-xl border border-white/20 bg-white/[0.04] px-5 py-3 font-brand text-sm font-semibold text-white transition hover:border-[#3B82F6] hover:bg-[#3B82F6]/10"
                    >
                      Subscribe to follow more pools
                    </button>
                    <p className="text-center font-ui text-xs text-[#9CA3AF]">
                      First pool stays free · Each additional pool is $1.99/month (10× annually)
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
                  <p className="font-ui text-sm text-white">No active pools found for this wallet.</p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 font-ui text-xs text-[#3B82F6] hover:text-[#60A5FA]"
                  >
                    Try another wallet
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
