'use client';

import React from 'react';
import WalletConnect from './WalletConnect';

interface HeaderProps {
  address?: string;
  balance?: string;
  onRefresh: () => void;
  onTest: () => void;
  activeCount: number;
  inactiveCount: number;
  onTabChange: (tab: 'active' | 'inactive') => void;
  activeTab: 'active' | 'inactive';
  onWalletConnected?: (address: string) => void;
  onWalletDisconnected?: () => void;
}

export default function Header({
  address,
  balance,
  onRefresh,
  onTest,
  activeCount,
  inactiveCount,
  onTabChange,
  activeTab,
  onWalletConnected,
  onWalletDisconnected,
}: HeaderProps) {
  return (
    <div className="w-full max-w-[1200px] mx-auto pt-8 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-enosys-subtext text-lg font-medium">Liquidity Pools</h1>
          <h2 className="text-white text-2xl font-bold mt-1">LP Manager</h2>
        </div>
        <div className="flex items-center gap-3">
          <WalletConnect 
            onWalletConnected={onWalletConnected}
            onWalletDisconnected={onWalletDisconnected}
          />
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-6">
        <div className="flex space-x-1">
          <button
            onClick={() => onTabChange('active')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'active'
                ? 'text-white font-bold'
                : 'text-enosys-subtext hover:text-enosys-text font-medium'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => onTabChange('inactive')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'inactive'
                ? 'text-white font-bold'
                : 'text-enosys-subtext hover:text-enosys-text font-medium'
            }`}
          >
            Inactive ({inactiveCount})
          </button>
        </div>
      </div>
    </div>
  );
}