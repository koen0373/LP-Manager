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
  const fetchPositions = async (address: string) => {
    setLoading(true);
    setError('');
    try {
      console.log('Fetching positions for address:', address);
      const walletPositions = await getWalletPositions(address);
      console.log('Received positions:', walletPositions);
      setPositions(walletPositions);
    } catch (err) {
      setError('Failed to fetch positions');
      console.error('Error fetching positions:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const headerNote = isClient && walletAddress 
    ? `Data from: On-chain Wallet Positions | ${positions.length} pools | Updated: ${new Date().toLocaleTimeString()}`
    : 'Connect your wallet to view LP positions';

  const handleTest = () => {
    console.log('Testing blockchain connection...');
  };

  const handleRefresh = () => {
    if (walletAddress) {
      fetchPositions(walletAddress);
    }
  };

  // Calculate counts for active/inactive positions
  const activeCount = positions.filter(p => p.status === 'Active').length;
  const inactiveCount = positions.filter(p => p.status === 'Inactive').length;

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
              No active LP positions found for this wallet
            </div>
          </div>
        ) : (
          <PositionsTable 
            positions={positions} 
            headerNote={headerNote} 
            globalRflrPriceUsd={rflrSpotUsd} 
            showTotalsRow={false}
          />
        )}
      </main>
    </>
  );
}
// Force deployment Mon Oct 20 15:45:00 CEST 2025 - Fixed React errors
