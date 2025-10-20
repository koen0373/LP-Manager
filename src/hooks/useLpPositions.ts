'use client';
import { useState, useEffect } from 'react';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { getWalletPositions, WalletPosition } from '@/lib/getWalletPositions';

export function useLpPositions() {
  const { address, isConnected } = useAccount();
  const [positions, setPositions] = useState<WalletPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());

  const fetchPositions = async (walletAddress: Address) => {
    setLoading(true);
    setError(null);
    
    try {
      const walletPositions = await getWalletPositions(walletAddress);
      setPositions(walletPositions);
      setUpdatedAt(new Date());
      console.log(`Found ${walletPositions.length} positions for wallet ${walletAddress}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch positions');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    if (address && isConnected) {
      fetchPositions(address);
    }
  };

  // Auto-fetch positions when wallet connects
  useEffect(() => {
    if (address && isConnected) {
      fetchPositions(address);
    } else {
      setPositions([]);
      setError(null);
    }
  }, [address, isConnected]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!address || !isConnected) return;

    const interval = setInterval(async () => {
      try {
        const walletPositions = await getWalletPositions(address);
        setPositions(walletPositions);
        setUpdatedAt(new Date());
        console.log('🔄 Auto-refreshed positions');
      } catch (err) {
        console.error('Auto-refresh failed:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [address, isConnected]);

  // Format address for display
  const formattedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : undefined;
  
  // Calculate total balance (simplified)
  const balance = positions.length > 0 ? `${positions.length} positions` : undefined;

  return {
    address: formattedAddress,
    balance,
    positions,
    loading,
    error,
    refresh,
    updatedAt,
  };
}
