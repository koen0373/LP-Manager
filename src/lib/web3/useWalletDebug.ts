'use client';

import { useAccount, useChainId } from 'wagmi';
import { useEffect, useRef } from 'react';

/**
 * Debug hook for wallet state logging (dev-only, env-gated)
 * 
 * Logs wallet state changes when:
 * - NODE_ENV !== 'production'
 * - NEXT_PUBLIC_DEBUG_WALLET_STATE === 'true'
 */
export function useWalletDebug() {
  const { address, isConnected, status, chainId: accountChainId } = useAccount();
  const chainId = useChainId();
  const prevStateRef = useRef<{ address: string | undefined; status: string; chainId: number } | null>(null);

  useEffect(() => {
    const isDev = process.env.NODE_ENV !== 'production';
    const debugEnabled = process.env.NEXT_PUBLIC_DEBUG_WALLET_STATE === 'true';

    if (!isDev || !debugEnabled) {
      return;
    }

    const currentState = {
      address: address,
      status: status,
      chainId: chainId,
    };

    const prevState = prevStateRef.current;

    if (
      !prevState ||
      prevState.address !== currentState.address ||
      prevState.status !== currentState.status ||
      prevState.chainId !== currentState.chainId
    ) {
      console.log('[WALLET_DEBUG]', {
        address: address || null,
        isConnected,
        status,
        chainId,
        timestamp: new Date().toISOString(),
      });

      prevStateRef.current = currentState;
    }
  }, [address, isConnected, status, chainId]);
}


