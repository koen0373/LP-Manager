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
}: HeaderProps) {
  return (
    <div className="w-full max-w-[1200px] mx-auto pt-8 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-enosys-subtext text-lg font-medium">Liquidity Pools</h1>
          <h2 className="text-white text-2xl font-bold mt-1">LP Manager</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              className="px-6 py-3 bg-enosys-blue hover:bg-enosys-blueHover rounded-lg text-lg font-medium transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={onTest}
              className="px-6 py-3 bg-enosys-subcard hover:bg-enosys-border rounded-lg text-lg font-medium transition-colors"
            >
              Test
            </button>
          </div>
          <WalletConnect />
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-6">
        <div className="flex space-x-1">
          <button
            onClick={() => onTabChange('active')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'active'
                ? 'bg-enosys-primary text-white'
                : 'text-enosys-subtext hover:text-enosys-text'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => onTabChange('inactive')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'inactive'
                ? 'bg-enosys-primary text-white'
                : 'text-enosys-subtext hover:text-enosys-text'
            }`}
          >
            Inactive ({inactiveCount})
          </button>
        </div>
      </div>
    </div>
  );
}