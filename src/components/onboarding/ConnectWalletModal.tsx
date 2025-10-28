'use client';

import React from 'react';
import Image from 'next/image';
import { useAccount, useConnect } from 'wagmi';
import { TokenIcon } from '@/components/TokenIcon';
import { formatUsd } from '@/utils/format';
import RangeBand, { getRangeStatus, RangeStatus } from '@/components/pools/PoolRangeIndicator';

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

type PoolSummary = {
  tokenId: string;
  pair: string;
  provider: string;
  poolId: string;
  feeTier: string;
  tvlUsd: number;
  feesUsd: number;
  dailyFeesUsd: number;
  incentivesUsd: number;
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

// Browser detection for installed wallets
function isWalletInstalled(walletId: string): boolean {
  if (typeof window === 'undefined') return false;
  
  switch (walletId) {
    case 'metamask':
      return !!(window as any).ethereum?.isMetaMask;
    case 'phantom':
      return !!(window as any).phantom?.ethereum;
    case 'okx':
      return !!(window as any).okxwallet;
    case 'rabby':
      return !!(window as any).ethereum?.isRabby;
    case 'brave':
      return !!(window as any).ethereum?.isBraveWallet;
    default:
      return false;
  }
}

export default function ConnectWalletModal({ isOpen, onClose }: ConnectWalletModalProps) {
  const { address } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const [phase, setPhase] = React.useState<'connect' | 'loading' | 'result'>('connect');
  const [topPool, setTopPool] = React.useState<PoolSummary | null>(null);
  const [activeCount, setActiveCount] = React.useState(0);
  const [inactiveCount, setInactiveCount] = React.useState(0);

  React.useEffect(() => {
    if (!isOpen) {
      setPhase('connect');
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
        
        const data = await res.json();
        
        if (!Array.isArray(data)) {
          console.warn('[ConnectWalletModal] Invalid response format');
          setPhase('result');
          return;
        }
        
        // Sort by TVL and find top pool (check both tvlUsd and amount fields)
        const sorted = data
          .filter((p: any) => {
            const tvl = p.tvlUsd ?? 0;
            return tvl > 0;
          })
          .sort((a: any, b: any) => {
            const aTvl = a.tvlUsd ?? 0;
            const bTvl = b.tvlUsd ?? 0;
            return bTvl - aTvl;
          });
        
        const top = sorted[0];
        if (top) {
          console.log('[ConnectWalletModal] Top pool data:', top);
          
          const token0Sym = top.token0Symbol ?? top.token0?.symbol ?? '?';
          const token1Sym = top.token1Symbol ?? top.token1?.symbol ?? '?';
          const rangeMin = top.lowerPrice ?? top.rangeMin ?? undefined;
          const rangeMax = top.upperPrice ?? top.rangeMax ?? undefined;
          
          // Use currentPrice from API, or calculate from range if missing
          let currentPrice = top.currentPrice;
          if (!currentPrice && rangeMin !== undefined && rangeMax !== undefined) {
            currentPrice = (rangeMin + rangeMax) / 2;
          }
          
          const status = getRangeStatus(currentPrice, rangeMin, rangeMax);
          
          console.log('[ConnectWalletModal] Range data:', { rangeMin, rangeMax, currentPrice, status });
          
          // Estimate daily fees (assume unclaimed fees accumulated over ~14 days)
          const unclaimedFees = top.rewardsUsd ?? top.feesUsd ?? 0;
          const dailyFees = unclaimedFees / 14;
          const tvl = top.tvlUsd ?? 0;
          const apr = tvl > 0 ? (dailyFees / tvl) * 365 * 100 : 0;
          
          setTopPool({
            tokenId: String(top.id ?? top.tokenId ?? ''),
            pair: `${token0Sym} / ${token1Sym}`,
            provider: top.provider ?? top.dexName ?? 'Unknown',
            poolId: String(top.poolId ?? top.id ?? ''),
            feeTier: top.feeTier ?? `${((top.feeTierBps ?? 0) / 100).toFixed(2)}%`,
            tvlUsd: tvl,
            feesUsd: unclaimedFees,
            dailyFeesUsd: dailyFees,
            incentivesUsd: top.rflrUsd ?? top.incentivesUsd ?? 0,
            rangeMin: rangeMin,
            rangeMax: rangeMax,
            currentPrice: currentPrice,
            token0PriceUsd: top.token0PriceUsd ?? top.token0?.priceUsd,
            status: status,
            apr: apr,
            token0Symbol: token0Sym,
            token1Symbol: token1Sym,
            token0Icon: top.token0Icon ?? top.token0?.iconSrc,
            token1Icon: top.token1Icon ?? top.token1?.iconSrc,
          });
        }
        
        // Count active pools (TVL > 0 or has fees)
        const active = data.filter((p: any) => {
          const tvl = p.tvlUsd ?? 0;
          const fees = p.rewardsUsd ?? p.feesUsd ?? 0;
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
  }, [address]);

  async function handleConnect(connectorId: string) {
    const connector = connectors.find((c) => c.id === connectorId);
    if (!connector) return;
    try {
      await connect({ connector });
    } catch (error) {
      console.error('[ConnectWalletModal] Failed to connect', error);
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

              <p className="mt-4 text-center font-ui text-xs text-[#9AA1AB]">
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
            <div className="space-y-5">
              {topPool ? (
                <>
                  <div className="rounded-xl border border-[#3B82F6]/20 bg-[#3B82F6]/5 p-4">
                    <p className="mb-3 font-ui text-xs uppercase tracking-wide text-[#3B82F6]">
                      Your top pool (by TVL) — Free to follow
                    </p>
                    
                    {/* Row 1: Icons + Pool Pair alleen */}
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
                    
                    {/* Provider + Fee Tier */}
                    <div className="mb-4 flex items-center gap-2 text-[10px] uppercase text-[#9AA1AB]/60">
                      <span>{topPool.provider}</span>
                      <span className="text-white/20">•</span>
                      <span className="font-semibold">{topPool.feeTier}</span>
                    </div>
                    
                    {/* Current price (always show if we have range data) */}
                    {(topPool.currentPrice !== undefined || (topPool.rangeMin && topPool.rangeMax)) && (
                      <div className="mb-3 rounded-lg border border-[#3B82F6]/20 bg-[#3B82F6]/5 px-4 py-3">
                        <div className="flex items-baseline justify-between">
                          <span className="font-ui text-xs uppercase tracking-wide text-[#3B82F6]">Current Price</span>
                          <div className="flex items-baseline gap-2">
                            <span className="tnum font-brand text-xl font-bold text-white">
                              ${(topPool.currentPrice ?? (topPool.rangeMin! + topPool.rangeMax!) / 2).toFixed(6)}
                            </span>
                            <span className="font-ui text-xs text-[#9AA1AB]">{topPool.token1Symbol}/{topPool.token0Symbol}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Data row: TVL, Fees, Incentives, APR */}
                    <div className="mb-4 grid grid-cols-4 gap-3">
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-[#9AA1AB]/50">TVL</p>
                        <p className="tnum mt-1 text-[15px] font-semibold text-white">{formatUsd(topPool.tvlUsd)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-[#9AA1AB]/50">Fees</p>
                        <p className="tnum mt-1 text-[15px] font-semibold text-white">{formatUsd(topPool.feesUsd)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-[#9AA1AB]/50">Incentives</p>
                        <p className="tnum mt-1 text-[15px] font-semibold text-white">{formatUsd(topPool.incentivesUsd)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase tracking-wide text-[#9AA1AB]/50">24h APR</p>
                        <p className="tnum mt-1 text-[15px] font-semibold text-white">{topPool.apr.toFixed(1)}%</p>
                      </div>
                    </div>
                    
                    {/* Range slider row */}
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                      {topPool.rangeMin !== undefined && topPool.rangeMax !== undefined ? (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1" data-ll-ui="v2025-10">
                            <RangeBand
                              min={topPool.rangeMin}
                              max={topPool.rangeMax}
                              current={topPool.currentPrice}
                              status={topPool.status}
                              token0Symbol={topPool.token0Symbol}
                              token1Symbol={topPool.token1Symbol}
                            />
                          </div>
                          <div className="flex flex-col items-end gap-1 text-right">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{
                                  background: topPool.status === 'in' ? '#00C66B' : topPool.status === 'near' ? '#FFA500' : '#E74C3C'
                                }}
                              />
                              <span className="text-[12px] font-medium text-white">
                                {topPool.status === 'in' ? 'In Range' : topPool.status === 'near' ? 'Near Band' : 'Out of Range'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-center font-ui text-xs text-[#9AA1AB]">Range data unavailable</p>
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
                      Subscribe to follow all pools
                    </button>
                    <p className="text-center font-ui text-xs text-[#9AA1AB]">
                      Sold in bundles of 5 · $1.99 per pool/month
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

