'use client';

import React from 'react';
import { useRouter } from 'next/router';
import WalletConnect from './WalletConnect';
import { TokenIcon } from '@/components/TokenIcon';

interface PoolDetailHeaderProps {
  tokenId: string;
  token0Symbol: string;
  token1Symbol: string;
  feeTierBps: number;
  poolAddress: string;
  inRange?: boolean;
  onRefresh: () => void;
  isLoading?: boolean;
  onWalletConnected?: (address: string) => void;
  onWalletDisconnected?: () => void;
}

export default function PoolDetailHeader({
  tokenId,
  token0Symbol,
  token1Symbol,
  feeTierBps,
  poolAddress,
  inRange,
  onRefresh,
  isLoading = false,
  onWalletConnected,
  onWalletDisconnected,
}: PoolDetailHeaderProps) {
  const router = useRouter();

  const handleBackToOverview = () => {
    router.push('/');
  };

  // Use the actual pool address from position data

  return (
    <div className="w-full max-w-[1200px] mx-auto pt-8 pb-4">
             {/* Header with My Pools button next to logo */}
             <div className="flex items-center justify-between">
               <div className="flex items-center space-x-4">
                 <div>
                   <h1 className="text-liqui-subtext text-lg font-medium">Liquidity Pools</h1>
                   <h2 className="text-white text-2xl font-bold mt-1">LP Manager</h2>
                 </div>
                 <button
                   onClick={handleBackToOverview}
                   className="flex items-center gap-2 px-3 py-2 text-liqui-subtext hover:text-white hover:font-bold rounded-lg transition-all duration-200"
                   title="Back to My Pools"
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
                       d="M15 18l-6-6 6-6"
                       stroke="currentColor"
                       strokeWidth="2"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                     />
                   </svg>
                   <span className="text-sm font-medium transition-all duration-200">My Pools</span>
                 </button>
               </div>
               <div className="flex items-center gap-3">
                 <button
                   onClick={onRefresh}
                   disabled={isLoading}
                   className="flex items-center gap-2 px-3 py-2 text-liqui-subtext hover:text-white hover:font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                   title="Refresh data"
                 >
                   <svg
                     width="16"
                     height="16"
                     viewBox="0 0 24 24"
                     fill="none"
                     xmlns="http://www.w3.org/2000/svg"
                     className={`transition-colors duration-200 ${isLoading ? 'animate-spin' : ''}`}
                   >
                     <path
                       d="M4 12a8 8 0 0 1 8-8V2l4 4-4 4V6a6 6 0 1 0 6 6h2a8 8 0 0 1-16 0z"
                       fill="currentColor"
                     />
                   </svg>
                   <span className="text-sm font-medium transition-all duration-200">
                     {isLoading ? 'Refreshing...' : 'Refresh'}
                   </span>
                 </button>
                 <WalletConnect
                   onWalletConnected={onWalletConnected}
                   onWalletDisconnected={onWalletDisconnected}
                 />
               </div>
             </div>

             {/* Empty row */}
             <div className="mt-6"></div>

             {/* Pool Detail section */}
             <div className="space-y-3">
               {/* Pool Detail header */}
               <div className="flex items-center space-x-3">
                 <div className="text-liqui-subtext text-sm font-medium">Pool Detail</div>
                 
                 {/* In/Out Range Indicator */}
                 {inRange !== undefined && (
                   <div className="flex items-center space-x-2">
                     <div className={`w-3 h-3 rounded-full ${inRange ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                     <span className={`text-sm font-medium ${inRange ? 'text-green-500' : 'text-red-500'}`}>
                       {inRange ? 'In Range' : 'Out of Range'}
                     </span>
                   </div>
                 )}
               </div>
               
               {/* Icons + Pool Pair */}
               <div className="flex items-center space-x-4">
                 <div className="flex -space-x-3">
                   <TokenIcon symbol={token0Symbol} size={48} className="ring-2 ring-[#0B1530]" />
                   <TokenIcon symbol={token1Symbol} size={48} className="ring-2 ring-[#0B1530]" />
                 </div>
                 <div className="text-white text-xl font-semibold">
                   {token0Symbol} - {token1Symbol}
                 </div>
               </div>

               {/* ID Number + Fee and Contract Number + Link Icon in one row */}
               <div className="flex items-center space-x-6">
                 <div className="flex items-center space-x-2">
                   <span className="text-white text-sm font-medium">ID #{tokenId}</span>
                   <span className="text-liqui-subtext text-sm">{(feeTierBps / 100).toFixed(1)}%</span>
                 </div>
                 <div className="flex items-center space-x-2">
                   <span className="text-white text-sm font-mono">{poolAddress.slice(0, 6)}...{poolAddress.slice(-4)}</span>
                   <a
                     href={`https://mainnet.flarescan.com/address/${poolAddress}`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="flex items-center justify-center w-6 h-6 text-liqui-subtext hover:text-white transition-all duration-200"
                     title="View contract on Flarescan"
                   >
                     <svg
                       width="14"
                       height="14"
                       viewBox="0 0 24 24"
                       fill="none"
                       xmlns="http://www.w3.org/2000/svg"
                       className="transition-colors duration-200"
                     >
                       <path
                         d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                         stroke="currentColor"
                         strokeWidth="2"
                         strokeLinecap="round"
                         strokeLinejoin="round"
                       />
                     </svg>
                   </a>
                 </div>
               </div>
             </div>
    </div>
  );
}
