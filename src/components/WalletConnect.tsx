'use client';

import React, { useState, useEffect } from 'react';

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string }) => Promise<string[]>;
    };
  }
}

interface WalletConnectProps {
  className?: string;
  onWalletConnected?: (address: string) => void;
  onWalletDisconnected?: () => void;
}

export default function WalletConnect({ className, onWalletConnected, onWalletDisconnected }: WalletConnectProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Check if wallet is already connected
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setIsConnected(true);
            setAddress(accounts[0]);
          }
        })
        .catch(console.error);
    }
  }, []);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleConnect = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
            if (accounts.length > 0) {
              setIsConnected(true);
              setAddress(accounts[0]);
              setShowModal(false);
              onWalletConnected?.(accounts[0]);
            }
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setAddress('');
    onWalletDisconnected?.();
  };

  if (!isClient) {
    return (
      <button
        className={`px-4 py-2 bg-enosys-subcard hover:bg-enosys-border rounded-lg text-sm font-medium transition-colors ${className || ''}`}
        disabled
      >
        Connect Wallet
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className={`flex items-center space-x-3 ${className || ''}`}>
        <div className="text-right">
          <div className="text-white text-sm font-medium">{formatAddress(address)}</div>
          <div className="text-enosys-subtext text-xs">Connected</div>
        </div>
        <button
          onClick={handleDisconnect}
          className="px-4 py-2 bg-enosys-subcard hover:bg-enosys-border rounded-lg text-sm font-medium transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`px-4 py-2 bg-enosys-subcard hover:bg-enosys-border rounded-lg text-sm font-medium transition-colors ${className || ''}`}
      >
        Connect Wallet
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-enosys-card rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-bold">Connect a Wallet</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-enosys-subtext hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Recommended */}
            <div className="mb-6">
              <h3 className="text-enosys-subtext text-sm font-medium mb-3">Recommended</h3>
              <div className="space-y-2">
                <button
                  onClick={handleConnect}
                  className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-enosys-subcard transition-colors"
                >
                  <div className="w-8 h-8 bg-enosys-subcard rounded-lg flex items-center justify-center">
                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">🦊</span>
                    </div>
                  </div>
                  <span className="text-white font-medium">MetaMask</span>
                </button>
                
                <button
                  onClick={handleConnect}
                  className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-enosys-subcard transition-colors"
                >
                  <div className="w-8 h-8 bg-enosys-subcard rounded-lg flex items-center justify-center">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">W</span>
                    </div>
                  </div>
                  <span className="text-white font-medium">WalletConnect</span>
                </button>
              </div>
            </div>

            {/* Other */}
            <div>
              <h3 className="text-enosys-subtext text-sm font-medium mb-3">Other</h3>
              <div className="space-y-2">
                <button
                  onClick={handleConnect}
                  className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-enosys-subcard transition-colors"
                >
                  <div className="w-8 h-8 bg-enosys-subcard rounded-lg flex items-center justify-center">
                    <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">🌐</span>
                    </div>
                  </div>
                  <span className="text-white font-medium">Browser Wallet</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
