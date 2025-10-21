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
  address: _address,
  balance: _balance,
  onRefresh: _onRefresh,
  onTest: _onTest,
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
          <button
            onClick={_onRefresh}
            className="flex items-center gap-2 px-3 py-2 text-enosys-subtext hover:text-white hover:font-bold rounded-lg transition-all duration-200"
            title="Refresh data"
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className="transition-colors duration-200"
            >
              <path 
                d="M4 12a8 8 0 0 1 8-8V2l4 4-4 4V6a6 6 0 1 0 6 6h2a8 8 0 0 1-16 0z" 
                fill="currentColor"
              />
            </svg>
            <span className="text-sm font-medium transition-all duration-200">Refresh</span>
          </button>
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
            className={`px-4 py-2 rounded-lg transition-colors hover:font-bold ${
              activeTab === 'active'
                ? 'text-white font-bold'
                : 'text-enosys-subtext hover:text-enosys-text font-medium'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => onTabChange('inactive')}
            className={`px-4 py-2 rounded-lg transition-colors hover:font-bold ${
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