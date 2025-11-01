'use client';
import React from 'react';

type Props = {
  address?: string;
  balance?: string;
  onRefresh?: () => void;
  onTest?: () => void;
  activeCount?: number;
  inactiveCount?: number;
  onTabChange?: (tab: 'active' | 'inactive') => void;
  activeTab?: 'active' | 'inactive';
};

export default function Header({ address, balance, onRefresh, onTest, activeCount = 0, inactiveCount = 0, onTabChange, activeTab = 'active' }: Props) {
  return (
    <div 
      className="w-full max-w-[1200px] mx-auto"
      style={{ 
        paddingTop: '32px', 
        paddingBottom: '32px' 
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold leading-tight text-enosys-text">Liquidity Pools</h1>
          {/* Lege rij boven Active Positions */}
          <div className="h-6"></div>
          <h2 className="text-[18px] font-medium text-enosys-text mt-2">
            {activeTab === 'active' ? `Active Positions (${activeCount})` : `Inactive Positions (${inactiveCount})`}
          </h2>
          {/* Twee lege rijen onder Active Positions */}
          <div className="h-12"></div>
        </div>
        <div className="flex items-center gap-6">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-enosys-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by token"
              className="pl-10 pr-4 py-3 w-64 bg-enosys-card border border-enosys-border rounded-lg text-enosys-text placeholder-enosys-subtext focus:outline-none focus:border-enosys-accentBlue transition-colors"
            />
          </div>
          
          {/* Tab Switcher */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onTabChange?.('active')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'active'
                  ? 'bg-enosys-accentBlue text-white shadow-lg'
                  : 'bg-enosys-card text-enosys-subtext hover:bg-enosys-hover border border-enosys-border'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 ${
                activeTab === 'active' 
                  ? 'border-white bg-white' 
                  : 'border-enosys-subtext'
              }`}>
                {activeTab === 'active' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-enosys-accentBlue rounded-full"></div>
                  </div>
                )}
              </div>
              Active Positions ({activeCount})
            </button>
            <button
              onClick={() => onTabChange?.('inactive')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'inactive'
                  ? 'bg-enosys-accentBlue text-white shadow-lg'
                  : 'bg-enosys-card text-enosys-subtext hover:bg-enosys-hover border border-enosys-border'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 ${
                activeTab === 'inactive' 
                  ? 'border-white bg-white' 
                  : 'border-enosys-subtext'
              }`}>
                {activeTab === 'inactive' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-enosys-accentBlue rounded-full"></div>
                  </div>
                )}
              </div>
              Inactive Positions ({inactiveCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
