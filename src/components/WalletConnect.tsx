'use client';

import React from 'react';
import ReactDOM from 'react-dom';
import Image from 'next/image';
import { flare } from 'wagmi/chains';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import qrcodeGenerator from 'qrcode-generator';

interface WalletConnectProps {
  className?: string;
  onWalletConnected?: (address: string) => void;
  onWalletDisconnected?: () => void;
}

type WalletOption =
  | { id: string; label: string; description: string; type: 'connector'; connectorId: string; icon: string }
  | { id: string; label: string; description: string; type: 'walletconnect'; connectorId: string; icon: string }
  | { id: string; label: string; description: string; type: 'external'; href: string; icon: string }
  | { id: string; label: string; description: string; type: 'disabled'; icon: string };

const WALLET_OPTIONS: WalletOption[] = [
  {
    id: 'metamask',
    label: 'MetaMask',
    description: 'Browser extension on Chrome, Brave, Edge, and Firefox.',
    type: 'connector',
    connectorId: 'injected',
    icon: '/icons/Metamask icon.svg',
  },
  {
    id: 'phantom',
    label: 'Phantom',
    description: 'Multi-chain wallet with browser extension and mobile app.',
    type: 'connector',
    connectorId: 'injected',
    icon: '/icons/phantom icon.png',
  },
  {
    id: 'okx',
    label: 'OKX Wallet',
    description: 'Built-in wallet from OKX exchange with multi-chain support.',
    type: 'connector',
    connectorId: 'injected',
    icon: '/icons/OKX icon.webp',
  },
  {
    id: 'brave',
    label: 'Brave Wallet',
    description: 'Built-in wallet in Brave browser with native Web3 support.',
    type: 'connector',
    connectorId: 'injected',
    icon: '/icons/brave icon.webp',
  },
  {
    id: 'bifrost',
    label: 'Bifrost',
    description: 'Flare network wallet with QR code support.',
    type: 'external',
    href: 'https://www.bifrostwallet.com/',
    icon: '/icons/bifrost.webp',
  },
  {
    id: 'rabby',
    label: 'Rabby',
    description: 'Flare-ready DeFi wallet with automatic network switching.',
    type: 'connector',
    connectorId: 'injected',
    icon: '/icons/rabby.webp',
  },
  {
    id: 'walletconnect',
    label: 'WalletConnect',
    description: 'Connect via QR code with any WalletConnect-compatible mobile wallet.',
    type: 'walletconnect',
    connectorId: 'walletConnect',
    icon: '/icons/wallet connect icon.webp',
  },
];

type WalletConnectProviderLike = {
  uri?: string;
};

function extractWalletConnectUri(provider: unknown): string | null {
  if (typeof provider !== 'object' || provider === null) {
    return null;
  }
  if (!('uri' in provider)) {
    return null;
  }
  const value = (provider as WalletConnectProviderLike).uri;
  return typeof value === 'string' ? value : null;
}

// Simple QR code generator
function generateQRCode(text: string, size = 160): string {
  const typeNumber = 0;
  const errorCorrectionLevel = 'M';
  const qrCode = qrcodeGenerator(typeNumber, errorCorrectionLevel);
  qrCode.addData(text);
  qrCode.make();

  const margin = 2;
  const numCells = qrCode.getModuleCount();
  const cellsWithMargin = numCells + margin * 2;
  const cellSize = Math.max(1, Math.floor(size / cellsWithMargin));
  const canvasSize = cellsWithMargin * cellSize;
  
  let rects = '';
  for (let row = 0; row < numCells; row++) {
    for (let col = 0; col < numCells; col++) {
      if (qrCode.isDark(row, col)) {
        const x = (col + margin) * cellSize;
        const y = (row + margin) * cellSize;
        rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#000"/>`;
      }
    }
  }
  
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasSize} ${canvasSize}">
    <rect width="${canvasSize}" height="${canvasSize}" fill="#fff"/>
    ${rects}
  </svg>`)}`;
}

export default function WalletConnect({ className, onWalletConnected, onWalletDisconnected }: WalletConnectProps) {
  const { address, status, chainId } = useAccount();
  const { connect, connectors, error: connectError, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const [showModal, setShowModal] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [showQR, setShowQR] = React.useState<string | null>(null);
  const [qrUri, setQrUri] = React.useState<string>('');
  const [mounted, setMounted] = React.useState(false);

  // Ensure we only render portal on client side
  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (address) {
      onWalletConnected?.(address);
      setShowModal(false);
      setLocalError(null);
      setShowQR(null);
      setQrUri('');
    } else if (status === 'disconnected') {
      onWalletDisconnected?.();
    }
  }, [address, status, onWalletConnected, onWalletDisconnected]);

  React.useEffect(() => {
    async function ensureFlare() {
      try {
        if (address && chainId !== flare.id) {
          await switchChainAsync?.({ chainId: flare.id });
        }
      } catch (error) {
        console.warn('[WalletConnect] Failed to switch chain', error);
        setLocalError('Please switch to the Flare network inside your wallet.');
      }
    }

    void ensureFlare();
  }, [address, chainId, switchChainAsync]);

  function handleOpenModal() {
    setLocalError(null);
    setShowQR(null);
    setQrUri('');
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setShowQR(null);
    setQrUri('');
  }

  async function handleDisconnect() {
    try {
      await disconnect();
      onWalletDisconnected?.();
    } catch (error) {
      console.error('[WalletConnect] disconnect failed', error);
    }
  }

  async function handleConnect(connectorId: string) {
    const connector = connectors.find((item) => item.id === connectorId);
    if (!connector) {
      setLocalError('Connector not available in this browser.');
      return;
    }
    try {
      setLocalError(null);
      await connect({ connector });
    } catch (error) {
      console.error('[WalletConnect] connect failed', error);
      setLocalError('Unable to connect wallet. Please try again.');
    }
  }

  async function handleShowQR(connectorId: string) {
    const connector = connectors.find((item) => item.id === connectorId);
    if (!connector) {
      setLocalError('WalletConnect not available.');
      return;
    }

    try {
      setLocalError(null);
      setShowQR(connectorId);

      // Get the URI from the connector
      const provider = await connector.getProvider();
      const uri = extractWalletConnectUri(provider);
      if (uri) {
        const qrDataUrl = generateQRCode(uri);
        setQrUri(qrDataUrl);
      }

      // Also attempt the connection
      await connect({ connector });
    } catch (error) {
      console.error('[WalletConnect] QR connect failed', error);
      setLocalError('Unable to connect via WalletConnect. Please try again.');
    }
  }

  const buttonLabel = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Connect wallet';

  // Render modal content
  const modalContent = showModal && mounted ? (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#05070C]/80 p-4"
      onClick={handleCloseModal}
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        margin: 0,
        padding: '1rem'
      }}
    >
      <div 
        className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-[rgba(10,15,26,0.95)] p-8 shadow-xl backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
        style={{ 
          margin: 'auto',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-brand text-2xl font-semibold text-white">Connect your wallet</h2>
                <p className="mt-2 font-ui text-sm text-white/60">
                  Choose a wallet to connect to LiquiLab
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {WALLET_OPTIONS.map((option) => {
                if (option.type === 'connector') {
                  const connector = connectors.find((item) => item.id === option.connectorId);
                  const disabled = !connector || isPending;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleConnect(option.connectorId)}
                      className={`group relative flex flex-col items-center gap-3 rounded-2xl border p-5 text-center transition ${
                        disabled
                          ? 'border-white/5 bg-white/[0.02] opacity-40'
                          : 'border-white/10 bg-white/[0.04] hover:border-[#3B82F6]/40 hover:bg-[#3B82F6]/5'
                      }`}
                    >
                      <div className="relative h-12 w-12">
                        <Image
                          src={option.icon}
                          alt={option.label}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <div>
                        <p className="font-brand text-sm font-semibold text-white">{option.label}</p>
                      </div>
                      {isPending && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#0A0F1C]/80">
                          <p className="font-ui text-xs text-[#3B82F6]">Connecting…</p>
                        </div>
                      )}
                    </button>
                  );
                }

                if (option.type === 'walletconnect') {
                  const connector = connectors.find((item) => item.id === option.connectorId);
                  const disabled = !connector || isPending;
                  const isShowingQR = showQR === option.connectorId;
                  
                  return (
                    <div key={option.id} className="col-span-3">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleShowQR(option.connectorId)}
                        className={`group relative flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
                          disabled
                            ? 'border-white/5 bg-white/[0.02] opacity-40'
                            : isShowingQR
                            ? 'border-[#3B82F6]/40 bg-[#3B82F6]/5'
                            : 'border-white/10 bg-white/[0.04] hover:border-[#3B82F6]/40 hover:bg-[#3B82F6]/5'
                        }`}
                      >
                        <div className="relative h-12 w-12 flex-shrink-0">
                          <Image
                            src={option.icon}
                            alt={option.label}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-brand text-base font-semibold text-white">{option.label}</p>
                          <p className="mt-0.5 font-ui text-xs text-white/50">
                            {option.description}
                          </p>
                        </div>
                        {isShowingQR && qrUri && (
                          <div className="flex-shrink-0 rounded-xl border border-white/10 bg-white p-2">
                            <Image src={qrUri} alt="QR Code" width={100} height={100} />
                          </div>
                        )}
                      </button>
                    </div>
                  );
                }

                if (option.type === 'external') {
                  return (
                    <a
                      key={option.id}
                      href={option.href}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center transition hover:border-[#3B82F6]/40 hover:bg-[#3B82F6]/5"
                    >
                      <div className="relative h-12 w-12">
                        <Image
                          src={option.icon}
                          alt={option.label}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <div>
                        <p className="font-brand text-sm font-semibold text-white">{option.label}</p>
                      </div>
                    </a>
                  );
                }

                return null;
              })}
            </div>

            {(localError || connectError) && (
              <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                <p className="font-ui text-sm text-red-200">
                  {localError ?? connectError?.message}
                </p>
              </div>
            )}

            <p className="mt-6 text-center font-ui text-xs text-white/40">
              Read-only access. No approvals needed.
            </p>
          </div>
        </div>
  ) : null;

  const buttonClass = address
    ? [
        'inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1530]',
        className,
      ]
        .filter(Boolean)
        .join(' ')
    : ['btn-primary', className].filter(Boolean).join(' ');

  return (
    <>
      <button type="button" onClick={address ? handleDisconnect : handleOpenModal} className={buttonClass}>
        {address ? `Disconnect ${buttonLabel}` : buttonLabel}
      </button>

      {mounted && modalContent && ReactDOM.createPortal(modalContent, document.body)}
    </>
  );
}
