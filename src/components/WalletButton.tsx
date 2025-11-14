'use client';

import React from 'react';
import { useAccount } from 'wagmi';
import WalletConnect from './WalletConnect';
import { useWalletDebug } from '@/lib/web3/useWalletDebug';

interface WalletButtonProps {
  className?: string;
  onWalletConnected?: (address: string) => void;
  onWalletDisconnected?: () => void;
}

export default function WalletButton({
  className,
  onWalletConnected,
  onWalletDisconnected,
}: WalletButtonProps) {
  const [mounted, setMounted] = React.useState(false);
  const { address, isConnected, status } = useAccount();

  // Debug logging (dev-only, env-gated)
  useWalletDebug();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render until mounted to avoid hydration mismatches
  if (!mounted) {
    return null;
  }

  return (
    <WalletConnect
      className={className}
      onWalletConnected={onWalletConnected}
      onWalletDisconnected={onWalletDisconnected}
    />
  );
}


