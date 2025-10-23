'use client';

import React from 'react';
import Head from 'next/head';
import Header from '../src/components/Header';
import PositionsTable from '../src/components/PositionsTable';
import type { PositionRow } from '../src/types/positions';

export default function LPManagerPage() {
  const [tab, setTab] = React.useState<'active' | 'inactive' | 'all'>('active');
  const [walletAddress, setWalletAddress] = React.useState<string>('');
  const [positions, setPositions] = React.useState<PositionRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState<string>('');
  const [isClient, setIsClient] = React.useState(true);

  // Ensure client-side rendering
  React.useEffect(() => {
    console.log('Setting isClient to true');
    setIsClient(true);
  }, []);

  // Auto-sync trigger
  const triggerAutoSync = async (tokenIds: number[]) => {
    try {
      console.log('[AUTO-SYNC] Triggering sync for positions:', tokenIds);
      setSyncing(true);

      const response = await fetch('/api/backfill/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenIds }),
      });

      const result = await response.json();
      console.log('[AUTO-SYNC] Response:', result);

      if (result.syncing) {
        // Start polling for completion
        startSyncPolling(tokenIds);
      } else {
        setSyncing(false);
      }
    } catch (err) {
      console.error('[AUTO-SYNC] Error:', err);
      setSyncing(false);
    }
  };

  // Poll sync status
  const startSyncPolling = (tokenIds: number[]) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5s intervals)

    const interval = setInterval(async () => {
      attempts++;

      try {
        const response = await fetch(`/api/backfill/status?tokenIds=${tokenIds.join(',')}`);
        const status = await response.json();

        console.log(`[POLLING] Attempt ${attempts}/${maxAttempts}:`, status);

        if (status.allFresh) {
          console.log('[POLLING] ✅ All positions synced!');
          clearInterval(interval);
          setSyncing(false);
          
          // Refresh positions with full data
          if (walletAddress) {
            fetchPositions(walletAddress, true);
          }
        } else if (attempts >= maxAttempts) {
          console.log('[POLLING] ⏱️ Timeout reached');
          clearInterval(interval);
          setSyncing(false);
        }
      } catch (err) {
        console.error('[POLLING] Error:', err);
        clearInterval(interval);
        setSyncing(false);
      }
    }, 5000); // Poll every 5 seconds
  };

  // Fetch positions when wallet connects
  const TVL_ACTIVE_THRESHOLD = 0.01; // USD

  const fetchPositions = React.useCallback(
    async (address: string, refresh = false) => {
      setLoading(true);
      setError('');
      try {
        console.log('[HOME] Fetching positions for address:', address);
        
        // Use API route for Vercel compatibility
        const url = `/api/positions?address=${address}${refresh ? '&refresh=1' : ''}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        
        console.log('[HOME] Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[HOME] Error response:', errorText);
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error('Invalid response format');
        }

        const walletPositions = data;
        console.log('[HOME] Received positions:', walletPositions.length);
        
        const normalizedPositions = walletPositions.map((position: PositionRow) => {
          const tvlUsd = Number(position.tvlUsd ?? 0);
          const rewardsUsd = Number(position.rewardsUsd ?? 0);
          const status = tvlUsd > TVL_ACTIVE_THRESHOLD ? 'Active' : 'Inactive';
          return {
            ...position,
            tvlUsd,
            rewardsUsd,
            status: status as 'Active' | 'Inactive',
          };
        });
        setPositions(normalizedPositions);
        setLastUpdated(new Date().toLocaleTimeString());

        // Trigger auto-sync for pool history
        if (walletPositions.length > 0) {
          triggerAutoSync(walletPositions.map(p => p.tokenId));
        }
      } catch (err) {
        console.error('[HOME] Error fetching positions:', err);
        setError(`Failed to fetch positions: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setPositions([]);
        setLastUpdated("");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Handle wallet connection
  const handleWalletConnected = (address: string) => {
    setWalletAddress(address);
    fetchPositions(address, true);
  };

  // Handle wallet disconnection
  const handleWalletDisconnected = () => {
    setWalletAddress('');
    setPositions([]);
    setError('');
    setLastUpdated('');
  };

  const [lastUpdated, setLastUpdated] = React.useState<string>('');

  // Update timestamp when positions change
  React.useEffect(() => {
    if (positions.length > 0) {
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }, [positions.length]);

  const handleRefresh = () => {
    if (walletAddress) {
      fetchPositions(walletAddress, true);
    }
  };

  // Utility function for robust sorting by rewards
  const sortByRewards = React.useCallback((a: PositionRow, b: PositionRow): number => {
    // Convert to numbers with fallback
    const aRewards = parseFloat(String(a.rewardsUsd || 0));
    const bRewards = parseFloat(String(b.rewardsUsd || 0));
    
    // Handle NaN cases - put them at the end
    if (isNaN(aRewards) && isNaN(bRewards)) return 0;
    if (isNaN(aRewards)) return 1;
    if (isNaN(bRewards)) return -1;
    
    // Sort high to low (descending)
    return bRewards - aRewards;
  }, []);

  // Calculate counts for active/inactive positions with robust sorting
  const activePositions = positions
    .filter((p) => p.status === 'Active')
    .sort(sortByRewards);
    
  const inactivePositions = positions
    .filter((p) => {
      // Only show inactive positions if they have rewards (RFLR, fees, etc.)
      const hasRewards = (p.rflrUsd && p.rflrUsd > 0) || 
                        (p.rewardsUsd && p.rewardsUsd > 0);
      return p.status === 'Inactive' && hasRewards;
    })
    .sort(sortByRewards);

  const activeCount = activePositions.length;
  const inactiveCount = inactivePositions.length;

  const activeHeaderNote =
    isClient && walletAddress
      ? `Data from: On-chain Wallet Positions | ${activePositions.length} active pools | Updated: ${lastUpdated}`
      : 'Connect your wallet to view LP positions';

  const inactiveHeaderNote = 'Inactive positions (TVL ≈ 0)';


  return (
    <>
      <Head>
        <title>Liqui LP Manager</title>
        <meta name="description" content="Manage your Uniswap V3 liquidity positions on Flare Network" />
      </Head>
      <main className="pb-20">
        <Header 
          onRefresh={handleRefresh}
          activeCount={activeCount}
          inactiveCount={inactiveCount}
          onTabChange={setTab}
          activeTab={tab}
          onWalletConnected={handleWalletConnected}
          onWalletDisconnected={handleWalletDisconnected}
          showTabs={true}
          currentPage="pools"
        />
        
        {!isClient ? (
          <div className="w-full max-w-[1200px] mx-auto text-center py-20">
            <div className="text-liqui-subtext text-lg">
              Loading...
            </div>
          </div>
        ) : !walletAddress ? (
          <div className="w-full max-w-[1200px] mx-auto text-center py-20">
            <div className="text-liqui-subtext text-lg">
              Connect your wallet to view your LP positions
            </div>
          </div>
        ) : loading ? (
          <div className="w-full max-w-[1200px] mx-auto text-center py-20">
            <div className="text-liqui-subtext text-lg">
              Loading positions...
            </div>
          </div>
        ) : syncing ? (
          <div className="w-full max-w-[1200px] mx-auto">
            {/* Show positions immediately if available */}
            {positions.length > 0 && (
              <div className="space-y-12">
                {/* Syncing loader banner */}
                <div className="rounded-lg border border-blue-500/30 bg-blue-900/10 px-6 py-8 text-center">
                  <div className="flex items-center justify-center space-x-3 mb-2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-lg font-medium text-blue-400">
                      Collecting your pooldata from the blockchain
                    </span>
                  </div>
                  <p className="text-sm text-liqui-subtext">
                    This may take up to 30 seconds...
                  </p>
                </div>

                {/* Show positions while syncing */}
                {tab === 'active' && activePositions.length > 0 && (
                  <PositionsTable 
                    positions={activePositions} 
                    headerNote={activeHeaderNote} 
                    showTotalsRow={false}
                  />
                )}

                {tab === 'inactive' && inactivePositions.length > 0 && (
                  <PositionsTable 
                    positions={inactivePositions} 
                    headerNote={inactiveHeaderNote} 
                    showTotalsRow={false}
                  />
                )}

                {tab === 'all' && (
                  <div className="space-y-12">
                    {activePositions.length > 0 && (
                      <PositionsTable 
                        positions={activePositions} 
                        headerNote={activeHeaderNote} 
                        showTotalsRow={false}
                      />
                    )}
                    {inactivePositions.length > 0 && (
                      <PositionsTable 
                        positions={inactivePositions} 
                        headerNote={inactiveHeaderNote} 
                        showTotalsRow={false}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : error ? (
          <div className="w-full max-w-[1200px] mx-auto text-center py-20">
            <div className="text-red-400 text-lg">
              {error}
            </div>
          </div>
        ) : positions.length === 0 ? (
          <div className="w-full max-w-[1200px] mx-auto text-center py-20">
            <div className="text-liqui-subtext text-lg">
              No LP positions found for this wallet
            </div>
          </div>
        ) : (
          <div className="w-full max-w-[1200px] mx-auto space-y-12">
            {tab === 'active' && (
              activePositions.length > 0 ? (
                <PositionsTable 
                  positions={activePositions} 
                  headerNote={activeHeaderNote} 
                  showTotalsRow={false}
                />
              ) : (
                <div className="rounded-lg border border-liqui-border bg-liqui-card px-6 py-10 text-center text-liqui-subtext">
                  <p className="text-lg">No active LP positions with TVL &gt; $0.01</p>
                </div>
              )
            )}

            {tab === 'inactive' && (
              inactivePositions.length > 0 ? (
                <PositionsTable 
                  positions={inactivePositions} 
                  headerNote={inactiveHeaderNote} 
                  showTotalsRow={false}
                />
              ) : (
                <div className="rounded-lg border border-liqui-border bg-liqui-card px-6 py-10 text-center text-liqui-subtext">
                  <p className="text-lg">No inactive LP positions</p>
                </div>
              )
            )}

            {tab === 'all' && (
              positions.length > 0 ? (
                <div className="space-y-12">
                  {activePositions.length > 0 && (
                    <PositionsTable 
                      positions={activePositions} 
                      headerNote={activeHeaderNote} 
                      showTotalsRow={false}
                    />
                  )}
                  {inactivePositions.length > 0 && (
                    <PositionsTable 
                      positions={inactivePositions} 
                      headerNote={inactiveHeaderNote} 
                      showTotalsRow={false}
                    />
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-liqui-border bg-liqui-card px-6 py-10 text-center text-liqui-subtext">
                  <p className="text-lg">No LP positions found</p>
                </div>
              )
            )}
          </div>
        )}
        
        {/* Disclaimer */}
        <div className="w-full max-w-[1200px] mx-auto px-4 py-8">
          <div className="p-6">
            <h3 className="text-liqui-text font-semibold mb-3">Disclaimer</h3>
            <p className="text-liqui-subtext text-sm leading-relaxed">
              The information displayed on this application is provided for informational purposes only and may not be accurate or up-to-date. 
              Data may vary from actual on-chain values due to network conditions, caching, or other technical factors. 
              This application is not financial advice and should not be used as the sole basis for making investment decisions. 
              Users are responsible for verifying all information independently and no rights can be derived from the data presented herein. 
              Always conduct your own research and consult with qualified professionals before making any financial decisions.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
// Force deployment Mon Oct 20 16:00:00 CEST 2025 - Wallet connect + FlareScan
