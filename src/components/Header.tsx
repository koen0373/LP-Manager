'use client';

import React from 'react';
import Link from 'next/link';
import WalletConnect from './WalletConnect';
import { LiquiLabLogo } from './LiquiLabLogo';

interface HeaderProps {
  onRefresh?: () => void;
  activeCount?: number;
  inactiveCount?: number;
  onTabChange?: (tab: 'active' | 'inactive' | 'all') => void;
  activeTab?: 'active' | 'inactive' | 'all';
  onWalletConnected?: (address: string) => void;
  onWalletDisconnected?: () => void;
  showTabs?: boolean;
  showWalletActions?: boolean;
  currentPage?: 'home' | 'faq' | 'summary' | 'pools' | 'pricing' | 'dashboard';
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
  showWalletActions = true,
  currentPage = 'home',
}: HeaderProps) {
  const handleRefresh = onRefresh ?? (() => {});

  return (
    <header className="sticky top-0 z-40 w-full bg-liqui-bg/95 backdrop-blur-sm border-b border-liqui-border">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-[84px] items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center">
              <LiquiLabLogo variant="full" size="sm" theme="dark" />
            </Link>
            {/* Vertical divider - centered with tagline */}
            <div className="hidden sm:flex items-center gap-4">
              <div className="h-12 w-[2px] bg-mist/40"></div>
              {/* Tagline */}
              <div className="flex flex-col leading-tight">
                <span className="font-brand text-mist text-[14px] font-medium tracking-wide">The Liquidity Pool</span>
                <span className="font-brand text-mist text-[14px] font-medium tracking-wide">Intelligence Platform</span>
              </div>
            </div>
          </div>

          {/* Navigation & Actions */}
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              href="/pricing"
              className={`font-brand text-sm transition-colors ${
                currentPage === 'pricing'
                  ? 'font-bold text-white'
                  : 'font-normal text-mist hover:text-white'
              }`}
            >
              Pricing
            </Link>
            <Link
              href="/faq"
              className={`font-brand text-sm transition-colors ${
                currentPage === 'faq'
                  ? 'font-bold text-white'
                  : 'font-normal text-mist hover:text-white'
              }`}
            >
              FAQ
            </Link>
            <Link
              href="/dashboard"
              className={`hidden font-brand text-sm transition-colors sm:inline ${
                currentPage === 'dashboard'
                  ? 'font-bold text-white'
                  : 'font-normal text-mist hover:text-white'
              }`}
            >
              Dashboard
            </Link>

            {showWalletActions && (
              <>
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-2 px-3 py-2 text-mist hover:text-white rounded-lg transition-all duration-200"
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-auto h-[2px] w-full max-w-[1400px] divider" />

      {/* Tabs row */}
      {showTabs && onTabChange && (
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 mt-6">
          <div className="flex space-x-1">
            <button
              onClick={() => onTabChange('active')}
              className={`px-4 py-2 rounded-lg transition-colors hover:font-bold ${
                activeTab === 'active'
                  ? 'text-white font-bold'
                  : 'text-mist hover:text-white font-normal'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => onTabChange('inactive')}
              className={`px-4 py-2 rounded-lg transition-colors hover:font-bold ${
                activeTab === 'inactive'
                  ? 'text-white font-bold'
                  : 'text-mist hover:text-white font-normal'
              }`}
            >
              Inactive ({inactiveCount})
            </button>
            <button
              onClick={() => onTabChange('all')}
              className={`px-4 py-2 rounded-lg transition-colors hover:font-bold ${
                activeTab === 'all'
                  ? 'text-white font-bold'
                  : 'text-mist hover:text-white font-normal'
              }`}
            >
              Show All ({activeCount + inactiveCount})
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
