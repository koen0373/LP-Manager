import React, { useState } from 'react';
import { TokenIcon } from './TokenIcon';
import { formatUsd, formatPercent } from '@/utils/format';

interface PoolData {
  tokenId: string;
  pairLabel: string;
  token0Symbol: string;
  token1Symbol: string;
  status: 'active' | 'inactive';
  tvlUsd: number;
  tvlAtMintUsd?: number;
  earningsUsd: number; // Total fees earned
  unclaimedFeesUsd?: number;
  fee0?: number;
  fee1?: number;
  rflrAmount: number;
  rflrUsd: number;
  roi?: number;
}

interface GroupedPoolsListProps {
  pools: PoolData[];
}

interface PairingGroup {
  pairLabel: string;
  token0Symbol: string;
  token1Symbol: string;
  pools: PoolData[];
  totalEarningsUsd: number;
  totalRflrAmount: number;
  totalRflrUsd: number;
  totalTvlUsd: number;
}

export const GroupedPoolsList: React.FC<GroupedPoolsListProps> = ({ pools }) => {
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());

  // Group pools by pairing
  const groupedPools: PairingGroup[] = React.useMemo(() => {
    const groups = new Map<string, PairingGroup>();

    pools.forEach(pool => {
      const key = pool.pairLabel;
      
      if (!groups.has(key)) {
        groups.set(key, {
          pairLabel: pool.pairLabel,
          token0Symbol: pool.token0Symbol,
          token1Symbol: pool.token1Symbol,
          pools: [],
          totalEarningsUsd: 0,
          totalRflrAmount: 0,
          totalRflrUsd: 0,
          totalTvlUsd: 0,
        });
      }

      const group = groups.get(key)!;
      group.pools.push(pool);
      group.totalEarningsUsd += pool.earningsUsd || 0;
      group.totalRflrAmount += pool.rflrAmount || 0;
      group.totalRflrUsd += pool.rflrUsd || 0;
      group.totalTvlUsd += pool.tvlUsd || 0;
    });

    // Convert to array and sort by total earnings (high to low)
    return Array.from(groups.values()).sort((a, b) => 
      (b.totalEarningsUsd + b.totalRflrUsd) - (a.totalEarningsUsd + a.totalRflrUsd)
    );
  }, [pools]);

  const togglePair = (pairLabel: string) => {
    setExpandedPairs(prev => {
      const next = new Set(prev);
      if (next.has(pairLabel)) {
        next.delete(pairLabel);
      } else {
        next.add(pairLabel);
      }
      return next;
    });
  };

  if (groupedPools.length === 0) {
    return (
      <div className="bg-enosys-card rounded-lg p-6">
        <p className="text-enosys-subtext text-center py-8">No positions found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupedPools.map(group => {
        const isExpanded = expandedPairs.has(group.pairLabel);
        const totalValue = group.totalEarningsUsd + group.totalRflrUsd;

        // Sort pools within group by earnings (high to low)
        const sortedPools = [...group.pools].sort((a, b) => 
          ((b.earningsUsd || 0) + (b.rflrUsd || 0)) - ((a.earningsUsd || 0) + (a.rflrUsd || 0))
        );

        return (
          <div key={group.pairLabel} className="bg-enosys-card rounded-lg overflow-hidden">
            {/* Pair Header - Clickable */}
            <button
              onClick={() => togglePair(group.pairLabel)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-enosys-subcard/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                {/* Token Icons */}
                <div className="flex items-center -space-x-2">
                  <TokenIcon symbol={group.token0Symbol} size={32} />
                  <TokenIcon symbol={group.token1Symbol} size={32} />
                </div>
                
                {/* Pair Label */}
                <h3 className="text-white text-lg font-bold">
                  {group.pairLabel}
                </h3>

                {/* Pool Count */}
                <span className="text-enosys-subtext text-sm">
                  ({group.pools.length} {group.pools.length === 1 ? 'pool' : 'pools'})
                </span>
              </div>

              <div className="flex items-center gap-6">
                {/* Total Value */}
                <div className="text-right">
                  <div className="text-white font-medium">
                    {formatUsd(totalValue)}
                  </div>
                  <div className="text-enosys-subtext text-sm">
                    Total Earnings
                  </div>
                </div>

                {/* Expand/Collapse Icon */}
                <div className={`text-enosys-subtext transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </div>
              </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t border-enosys-border">
                {/* Individual Pools */}
                <div className="divide-y divide-enosys-border">
                  {sortedPools.map(pool => (
                    <div key={pool.tokenId} className="px-6 py-4 hover:bg-enosys-subcard/20 transition-colors">
                      <div className="flex items-start justify-between">
                        {/* Left: Pool Info */}
                        <div className="flex items-center gap-3">
                          {/* Status Indicator */}
                          <div className={`w-2 h-2 rounded-full ${pool.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}`} />
                          
                          {/* Pool ID */}
                          <div className="text-white font-medium">
                            Pool #{pool.tokenId}
                          </div>

                          {/* Status Label */}
                          <div className={`text-xs px-2 py-1 rounded ${
                            pool.status === 'active' 
                              ? 'bg-green-500/10 text-green-500' 
                              : 'bg-gray-500/10 text-gray-500'
                          }`}>
                            {pool.status === 'active' ? 'Active' : 'Inactive'}
                          </div>
                        </div>

                        {/* Right: Earnings + TVL + ROI */}
                        <div className="flex items-start gap-8">
                          {/* Earnings */}
                          <div className="text-right">
                            <div className="text-white font-medium mb-1">
                              {formatUsd((pool.earningsUsd || 0) + (pool.rflrUsd || 0))}
                            </div>
                            <div className="text-enosys-subtext text-sm space-y-0.5">
                              {pool.earningsUsd > 0 && (
                                <div>Fees: {formatUsd(pool.earningsUsd)}</div>
                              )}
                              {pool.fee0 !== undefined && pool.fee1 !== undefined && (
                                <div className="text-xs">
                                  {pool.fee0.toFixed(4)} {pool.token0Symbol} + {pool.fee1.toFixed(4)} {pool.token1Symbol}
                                </div>
                              )}
                              {pool.rflrAmount > 0 && (
                                <div>RFLR: {pool.rflrAmount.toFixed(2)} ({formatUsd(pool.rflrUsd)})</div>
                              )}
                            </div>
                          </div>

                          {/* TVL */}
                          <div className="text-right">
                            <div className="text-enosys-subtext text-xs mb-1">TVL</div>
                            {pool.tvlAtMintUsd !== undefined && (
                              <div className="text-enosys-subtext text-sm mb-0.5">
                                At mint: {formatUsd(pool.tvlAtMintUsd)}
                              </div>
                            )}
                            <div className="text-white font-medium">
                              Current: {formatUsd(pool.tvlUsd)}
                            </div>
                          </div>

                          {/* ROI */}
                          {pool.roi !== undefined && (
                            <div className="text-right">
                              <div className="text-enosys-subtext text-xs mb-1">ROI</div>
                              <div className={`font-medium ${pool.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {pool.roi >= 0 ? '+' : ''}{formatPercent(pool.roi)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Row for this Pairing */}
                <div className="px-6 py-4 bg-enosys-subcard/30 border-t-2 border-enosys-border">
                  <div className="flex items-center justify-between">
                    <div className="text-white font-bold">
                      Total for {group.pairLabel}
                    </div>
                    <div className="flex items-center gap-8">
                      {/* Total Earnings */}
                      <div className="text-right">
                        <div className="text-white font-bold mb-1">
                          {formatUsd(group.totalEarningsUsd + group.totalRflrUsd)}
                        </div>
                        <div className="text-enosys-subtext text-sm">
                          {group.totalEarningsUsd > 0 && <div>Fees: {formatUsd(group.totalEarningsUsd)}</div>}
                          {group.totalRflrAmount > 0 && (
                            <div>RFLR: {group.totalRflrAmount.toFixed(2)} ({formatUsd(group.totalRflrUsd)})</div>
                          )}
                        </div>
                      </div>

                      {/* Total TVL */}
                      <div className="text-right">
                        <div className="text-enosys-subtext text-xs mb-1">Total TVL</div>
                        <div className="text-white font-bold">
                          {formatUsd(group.totalTvlUsd)}
                        </div>
                      </div>

                      {/* Spacer for ROI column alignment */}
                      <div className="w-20"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

