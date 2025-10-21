'use client';

import React from 'react';
import Head from 'next/head';
import Header from '../src/components/Header';
import PositionsTable from '../src/components/PositionsTable';
import type { PositionRow } from '../src/types/positions';
import { getWalletPositions } from '../src/services/flarescanService';

export default function LPManagerPage() {
  const [tab, setTab] = React.useState<'active' | 'inactive'>('active');
  const [walletAddress, setWalletAddress] = React.useState<string>('');
  const [positions, setPositions] = React.useState<PositionRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>('');
  const [isClient, setIsClient] = React.useState(false);
  const rflrSpotUsd = 0.01758; // actuele koers

  // Ensure client-side rendering
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch positions when wallet connects
  const TVL_ACTIVE_THRESHOLD = 0.01; // USD

  const fetchPositions = React.useCallback(
    async (address: string) => {
      setLoading(true);
      setError('');
      try {
        console.log('Fetching positions for address:', address);
        const walletPositions = await getWalletPositions(address);
        console.log('Received positions:', walletPositions);
        const normalizedPositions = walletPositions.map((position) => {
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
      } catch (err) {
        setError('Failed to fetch positions');
        console.error('Error fetching positions:', err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Handle wallet connection
  const handleWalletConnected = (address: string) => {
    setWalletAddress(address);
    fetchPositions(address);
  };

  // Handle wallet disconnection
  const handleWalletDisconnected = () => {
    setWalletAddress('');
    setPositions([]);
    setError('');
  };

  const [lastUpdated, setLastUpdated] = React.useState<string>('');

  // Update timestamp when positions change
  React.useEffect(() => {
    if (positions.length > 0) {
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }, [positions.length]);

  const handleTest = () => {
    console.log('Testing blockchain connection...');
  };

  const handleRefresh = () => {
    if (walletAddress) {
      fetchPositions(walletAddress);
    }
  };

  // Calculate counts for active/inactive positions
  const activePositions = positions.filter((p) => p.status === 'Active');
  const inactivePositions = positions.filter((p) => p.status === 'Inactive');

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
        <title>Enosys LP Manager</title>
        <meta name="description" content="Manage your Enosys V3 liquidity positions on Flare Network" />
      </Head>
      <main className="pb-20">
        <Header 
          address={walletAddress}
          balance=""
          onRefresh={handleRefresh}
          onTest={handleTest}
          activeCount={activeCount}
          inactiveCount={inactiveCount}
          onTabChange={setTab}
          activeTab={tab}
          onWalletConnected={handleWalletConnected}
          onWalletDisconnected={handleWalletDisconnected}
        />
        
        {!isClient ? (
          <div className="w-full max-w-[1200px] mx-auto text-center py-20">
            <div className="text-enosys-subtext text-lg">
              Loading...
            </div>
          </div>
        ) : !walletAddress ? (
          <div className="w-full max-w-[1200px] mx-auto text-center py-20">
            <div className="text-enosys-subtext text-lg">
              Connect your wallet to view your LP positions
            </div>
          </div>
        ) : loading ? (
          <div className="w-full max-w-[1200px] mx-auto text-center py-20">
            <div className="text-enosys-subtext text-lg">
              Loading positions...
            </div>
          </div>
        ) : error ? (
          <div className="w-full max-w-[1200px] mx-auto text-center py-20">
            <div className="text-red-400 text-lg">
              {error}
            </div>
          </div>
        ) : positions.length === 0 ? (
          <div className="w-full max-w-[1200px] mx-auto text-center py-20">
            <div className="text-enosys-subtext text-lg">
              No LP positions found for this wallet
            </div>
          </div>
        ) : (
          <div className="w-full max-w-[1200px] mx-auto space-y-12">
            {activePositions.length > 0 ? (
              <PositionsTable 
                positions={activePositions} 
                headerNote={activeHeaderNote} 
                globalRflrPriceUsd={rflrSpotUsd} 
                showTotalsRow={false}
              />
            ) : (
              <div className="rounded-lg border border-enosys-border bg-enosys-card px-6 py-10 text-center text-enosys-subtext">
                <p className="text-lg">No active LP positions with TVL &gt; $0.01</p>
              </div>
            )}

            {inactivePositions.length > 0 && (
              <PositionsTable 
                positions={inactivePositions} 
                headerNote={inactiveHeaderNote} 
                globalRflrPriceUsd={rflrSpotUsd} 
                showTotalsRow={false}
              />
            )}
          </div>
        )}
      </main>
    </>
  );
}
// Force deployment Mon Oct 20 16:00:00 CEST 2025 - Wallet connect + FlareScan
