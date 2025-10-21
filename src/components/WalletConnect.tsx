'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (accounts: string[]) => void) => void;
      removeListener: (event: string, callback: (accounts: string[]) => void) => void;
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
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [currentNetwork, setCurrentNetwork] = useState('Flare');
  
  // Use refs to store stable references to callbacks
  const onWalletConnectedRef = useRef(onWalletConnected);
  const onWalletDisconnectedRef = useRef(onWalletDisconnected);
  
  // Update refs when props change
  useEffect(() => {
    onWalletConnectedRef.current = onWalletConnected;
    onWalletDisconnectedRef.current = onWalletDisconnected;
  }, [onWalletConnected, onWalletDisconnected]);

  // Stable disconnect function (now handled in handleDisconnect)
  const disconnectWallet = useCallback(() => {
    console.log('Disconnecting wallet...');
    setIsConnected(false);
    setAddress('');
    onWalletDisconnectedRef.current?.();
    console.log('Wallet disconnected');
  }, []);

  // Stable connect function
  const connectWallet = useCallback((newAddress: string) => {
    console.log('Connecting wallet:', newAddress);
    setIsConnected(true);
    setAddress(newAddress);
    onWalletConnectedRef.current?.(newAddress);
  }, []);

  useEffect(() => {
    setIsClient(true);
    
    if (typeof window === 'undefined' || !window.ethereum) {
      return;
    }

    // Check if wallet is already connected
    const checkConnection = async () => {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          connectWallet(accounts[0]);
        }
        
        // Check current chain and set network
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const network = networks.find(n => n.chainId === chainId);
        if (network) {
          setCurrentNetwork(network.name);
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    };

    checkConnection();

    // Event handlers with stable references
    const handleAccountsChanged = (accounts: string[]) => {
      console.log('Accounts changed:', accounts);
      if (!accounts || accounts.length === 0) {
        // Use the simple disconnect for account changes
        disconnectWallet();
      } else {
        connectWallet(accounts[0]);
      }
    };

    const handleChainChanged = (chainId: string) => {
      console.log('Chain changed to:', chainId);
      const network = networks.find(n => n.chainId === chainId);
      if (network) {
        setCurrentNetwork(network.name);
        console.log(`Connected to ${network.name} network`);
        // If we have a connected address, trigger re-fetch
        if (isConnected && address) {
          onWalletConnectedRef.current?.(address);
        }
      } else {
        console.log('Connected to unknown network');
      }
    };

    // Add event listeners
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Cleanup function
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [connectWallet, disconnectWallet, isConnected, address]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNetworkDropdown) {
        const target = event.target as Element;
        if (!target.closest('.network-selector')) {
          setShowNetworkDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNetworkDropdown]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const networks = [
    {
      name: 'Flare',
      chainId: '0xe',
      icon: (
        <img 
          src="/icons/flr.network.webp" 
          alt="Flare" 
          width="16" 
          height="16" 
          className="rounded-full"
        />
      ),
      color: 'from-pink-500 to-red-500',
      rpcUrl: 'https://flare-api.flare.network/ext/C/rpc',
      blockExplorer: 'https://flare.space'
    },
    {
      name: 'Songbird',
      chainId: '0x13',
      icon: (
        <img 
          src="/icons/sgb.network.webp" 
          alt="Songbird" 
          width="16" 
          height="16" 
          className="rounded-full"
        />
      ),
      color: 'from-black to-gray-800',
      rpcUrl: 'https://songbird-api.flare.network/ext/C/rpc',
      blockExplorer: 'https://songbird-explorer.flare.network'
    },
    {
      name: 'Coston',
      chainId: '0x10',
      icon: (
        <img 
          src="/icons/cflr.network.webp" 
          alt="Coston" 
          width="16" 
          height="16" 
          className="rounded-full"
        />
      ),
      color: 'from-orange-500 to-orange-600',
      rpcUrl: 'https://coston-api.flare.network/ext/C/rpc',
      blockExplorer: 'https://coston-explorer.flare.network'
    },
    {
      name: 'Coston 2',
      chainId: '0x11',
      icon: (
        <img 
          src="/icons/cflr2.network.webp" 
          alt="Coston 2" 
          width="16" 
          height="16" 
          className="rounded-full"
        />
      ),
      color: 'from-orange-500 to-orange-600',
      rpcUrl: 'https://coston2-api.flare.network/ext/C/rpc',
      blockExplorer: 'https://coston2-explorer.flare.network'
    }
  ];

  const switchNetwork = async (network: typeof networks[0]) => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        console.log(`Switching to ${network.name} network...`);
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: network.chainId }],
        });
        setCurrentNetwork(network.name);
        setShowNetworkDropdown(false);
      } catch (switchError: any) {
        // If the chain doesn't exist, add it
        if (switchError.code === 4902) {
          console.log(`Adding ${network.name} network...`);
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: network.chainId,
              chainName: network.name,
              nativeCurrency: {
                name: network.name === 'Flare' ? 'Flare' : network.name,
                symbol: network.name === 'Flare' ? 'FLR' : network.name.substring(0, 3).toUpperCase(),
                decimals: 18,
              },
              rpcUrls: [network.rpcUrl],
              blockExplorerUrls: [network.blockExplorer],
            }],
          });
          setCurrentNetwork(network.name);
          setShowNetworkDropdown(false);
        } else {
          throw switchError;
        }
      }
    }
  };

  const handleConnect = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        console.log('Requesting wallet connection...');
        
        // First, request accounts
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        console.log('Received accounts:', accounts);
        
        if (accounts && accounts.length > 0) {
          // Check current chain ID
          const chainId = await window.ethereum.request({ 
            method: 'eth_chainId' 
          });
          console.log('Current chain ID:', chainId);
          
          // Flare mainnet chain ID is 0xe (14 in decimal)
          const flareChainId = '0xe';
          
          if (chainId !== flareChainId) {
            try {
              console.log('Switching to Flare network...');
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: flareChainId }],
              });
            } catch (switchError: any) {
              // If the chain doesn't exist, add it
              if (switchError.code === 4902) {
                console.log('Adding Flare network...');
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: flareChainId,
                    chainName: 'Flare',
                    nativeCurrency: {
                      name: 'Flare',
                      symbol: 'FLR',
                      decimals: 18,
                    },
                    rpcUrls: ['https://flare-api.flare.network/ext/C/rpc'],
                    blockExplorerUrls: ['https://flare.space'],
                  }],
                });
              } else {
                throw switchError;
              }
            }
          }
          
          // Use the stable connect function
          connectWallet(accounts[0]);
          setShowModal(false);
          console.log('Wallet connected to Flare:', accounts[0]);
        }
      } catch (error: any) {
        console.error('Failed to connect wallet:', error);
        
        if (error.code === 4001) {
          alert('Connection rejected by user.');
        } else if (error.code === -32002) {
          alert('Connection request already pending. Please check your wallet.');
        } else {
          alert('Failed to connect wallet. Please make sure MetaMask is installed and unlocked.');
        }
      }
    } else {
      alert('MetaMask is not installed. Please install MetaMask to connect your wallet.');
    }
  };

  const handleDisconnect = async () => {
    console.log('Starting wallet disconnect process...');
    setIsDisconnecting(true);
    
    try {
      // First, try to disconnect via MetaMask if available
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          // Some wallets support wallet_revokePermissions
          await window.ethereum.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }]
          });
          console.log('Successfully revoked wallet permissions');
        } catch (revokeError: any) {
          // This is expected for many wallets that don't support revokePermissions
          console.log('Wallet does not support revokePermissions, continuing with local disconnect');
        }
        
        // Force clear any cached state by checking accounts
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          console.log('Current accounts after disconnect attempt:', accounts);
        } catch (error) {
          console.log('Could not check accounts after disconnect:', error);
        }
      }
      
      // Always perform local disconnect regardless of wallet response
      console.log('Performing local disconnect...');
      setIsConnected(false);
      setAddress('');
      onWalletDisconnectedRef.current?.();
      
      // Clear any localStorage/sessionStorage that might cache wallet state
      try {
        localStorage.removeItem('walletconnect');
        localStorage.removeItem('walletconnect_v2');
        sessionStorage.removeItem('walletconnect');
        sessionStorage.removeItem('walletconnect_v2');
        console.log('Cleared wallet storage');
      } catch (error) {
        console.log('Could not clear wallet storage:', error);
      }
      
      console.log('Wallet disconnect completed');
      
    } catch (error) {
      console.error('Error during disconnect:', error);
      // Even if there's an error, we should still disconnect locally
      setIsConnected(false);
      setAddress('');
      onWalletDisconnectedRef.current?.();
    } finally {
      // Reset disconnecting state after a delay
      setTimeout(() => {
        setIsDisconnecting(false);
      }, 1500);
    }
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
    const currentNetworkData = networks.find(n => n.name === currentNetwork) || networks[0];
    
    return (
      <div className={`flex items-center space-x-3 ${className || ''}`}>
        {/* Network Selector */}
        <div className="relative network-selector">
          <div 
            className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-enosys-hover/20 transition-colors cursor-pointer hover:font-bold"
            onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
          >
            <div className="w-6 h-6 flex items-center justify-center">
              {currentNetworkData.icon}
            </div>
            <span className="text-white text-sm font-medium">{currentNetwork}</span>
            <svg 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className={`text-enosys-subtext transition-transform ${showNetworkDropdown ? 'rotate-180' : ''}`}
            >
              <path 
                d="M6 9l6 6 6-6" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Network Dropdown */}
          {showNetworkDropdown && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-enosys-card border border-enosys-border rounded-lg shadow-lg z-50">
              {networks.map((network) => (
                <button
                  key={network.name}
                  onClick={() => switchNetwork(network)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-enosys-hover/20 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    network.name === currentNetwork ? 'bg-enosys-hover/10' : ''
                  }`}
                >
                  <div className="w-6 h-6 flex items-center justify-center">
                    {network.icon}
                  </div>
                  <span className="text-white text-sm font-medium">{network.name}</span>
                  {network.name === currentNetwork && (
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-green-400 ml-auto"
                    >
                      <path 
                        d="M20 6L9 17l-5-5" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-enosys-border"></div>

        {/* Wallet Info */}
        <div className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-enosys-hover/20 transition-colors cursor-pointer hover:font-bold">
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="text-enosys-subtext"
          >
            <path 
              d="M21 12V7H5a2 2 0 0 1 0-4h14v4" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M3 5v14a2 2 0 0 0 2 2h16v-5" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <circle 
              cx="12" 
              cy="12" 
              r="1" 
              fill="currentColor"
            />
          </svg>
          <span className="text-enosys-subtext text-sm font-medium">{formatAddress(address)}</span>
          <div className="w-1 h-1 bg-enosys-subtext rounded-full"></div>
          <span className="text-enosys-subtext text-sm font-medium">11.22 FLR</span>
        </div>

        {/* Disconnect Icon */}
        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="p-2 rounded-lg hover:bg-enosys-hover/20 transition-colors hover:font-bold"
          title={isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className={`transition-colors ${
              isDisconnecting 
                ? 'text-enosys-subtext' 
                : 'text-enosys-subtext hover:text-white'
            }`}
          >
            <path 
              d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <polyline 
              points="16,17 21,12 16,7" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <line 
              x1="21" 
              y1="12" 
              x2="9" 
              y2="12" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`px-4 py-2 bg-enosys-subcard hover:bg-enosys-border rounded-lg text-sm font-medium transition-colors hover:font-bold ${className || ''}`}
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
