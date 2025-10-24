'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import WalletConnect from './WalletConnect';

interface HeaderProps {
  onRefresh?: () => void;
  activeCount?: number;
  inactiveCount?: number;
  onTabChange?: (tab: 'active' | 'inactive' | 'all') => void;
  activeTab?: 'active' | 'inactive' | 'all';
  onWalletConnected?: (address: string) => void;
  onWalletDisconnected?: () => void;
  showTabs?: boolean;
  currentPage?: 'pools' | 'summary';
}

export default function Header({
  onRefresh,
  activeCount = 0,
  inactiveCount = 0,
  onTabChange,
  activeTab = 'active',
  onWalletConnected,
  onWalletDisconnected,
  showTabs = true,
  currentPage = 'pools',
}: HeaderProps) {
  const [logoError, setLogoError] = useState(false);
  const handleRefresh = onRefresh ?? (() => {});

  const LogoComponent = () => {
    if (logoError) {
      // Fallback to text if logo fails to load
      return (
        <div className="flex items-center h-16">
          <span className="text-white text-2xl font-bold">Liqui</span>
        </div>
      );
    }

    return (
      <Image
        src="/icons/liqui_logo.webp"
        alt="Liqui Logo"
        width={169}
        height={56}
        className="object-contain h-auto"
        onError={() => setLogoError(true)}
        priority
        unoptimized={true}
        quality={90}
      />
    );
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto pt-6 pb-4">
      <div className="flex w-full flex-col gap-4">
        {/* Main header row */}
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center">
              <LogoComponent />
            </Link>
            <Link 
              href="/" 
              className={`text-sm transition-colors ${
                currentPage === 'pools' 
                  ? 'font-bold text-white' 
                  : 'font-normal text-liqui-subtext hover:text-white'
              }`}
            >
              My Pools
            </Link>
            <Link 
              href="/summary" 
              className={`text-sm transition-colors ${
                currentPage === 'summary' 
                  ? 'font-bold text-white' 
                  : 'font-normal text-liqui-subtext hover:text-white'
              }`}
            >
              Portfolio Performance
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-2 text-liqui-subtext hover:text-white rounded-lg transition-all duration-200"
              title="Refresh data"
              type="button"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="transition-colors duration-200"
                aria-hidden
              >
                <path
                  d="M4 12a8 8 0 0 1 8-8V2l4 4-4 4V6a6 6 0 1 0 6 6h2a8 8 0 0 1-16 0z"
                  fill="currentColor"
                />
              </svg>
              <span className="text-sm font-normal transition-all duration-200">Refresh</span>
            </button>
            <WalletConnect
              onWalletConnected={onWalletConnected}
              onWalletDisconnected={onWalletDisconnected}
            />
          </div>
        </div>

        {/* Tabs row */}
        {showTabs && onTabChange && (
        <div className="flex items-center justify-between mt-6">
          <div className="flex space-x-1">
            <button
              onClick={() => onTabChange('active')}
              className={`px-4 py-2 rounded-lg transition-colors hover:font-bold ${
                activeTab === 'active'
                  ? 'text-white font-bold'
                  : 'text-liqui-subtext hover:text-liqui-text font-normal'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => onTabChange('inactive')}
              className={`px-4 py-2 rounded-lg transition-colors hover:font-bold ${
                activeTab === 'inactive'
                  ? 'text-white font-bold'
                  : 'text-liqui-subtext hover:text-liqui-text font-normal'
              }`}
            >
              Inactive ({inactiveCount})
            </button>
            <button
              onClick={() => onTabChange('all')}
              className={`px-4 py-2 rounded-lg transition-colors hover:font-bold ${
                activeTab === 'all'
                  ? 'text-white font-bold'
                  : 'text-liqui-subtext hover:text-liqui-text font-normal'
              }`}
            >
              Show All ({activeCount + inactiveCount})
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
