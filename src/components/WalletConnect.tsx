'use client';

import React from 'react';
import { flare } from 'wagmi/chains';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';

interface WalletConnectProps {
  className?: string;
  onWalletConnected?: (address: string) => void;
  onWalletDisconnected?: () => void;
}

type WalletOption =
  | { id: string; label: string; description: string; type: 'connector'; connectorId: string }
  | { id: string; label: string; description: string; type: 'external'; href: string }
  | { id: string; label: string; description: string; type: 'disabled' };

const WALLET_OPTIONS: WalletOption[] = [
  {
    id: 'metamask',
    label: 'MetaMask',
    description: 'Browser extension on Chrome, Brave, Edge, and Firefox.',
    type: 'connector',
    connectorId: 'injected',
  },
  {
    id: 'rabby',
    label: 'Rabby Wallet',
    description: 'Flare-ready DeFi wallet with automatic network switching (uses browser injection).',
    type: 'connector',
    connectorId: 'injected',
  },
  {
    id: 'bifrost',
    label: 'Bifrost Wallet',
    description: 'Scan the QR code inside Bifrost to sign requests (mobile).',
    type: 'external',
    href: 'https://www.bifrostwallet.com/',
  },
  {
    id: 'xaman',
    label: 'Xaman (coming soon)',
    description: 'Desktop integration is on the roadmap. Use the mobile app today.',
    type: 'disabled',
  },
];

export default function WalletConnect({ className, onWalletConnected, onWalletDisconnected }: WalletConnectProps) {
  const { address, status, chainId } = useAccount();
  const { connect, connectors, error: connectError, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const [showModal, setShowModal] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (address) {
      onWalletConnected?.(address);
      setShowModal(false);
      setLocalError(null);
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
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
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

  const buttonLabel = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Connect wallet';

  return (
    <>
      <button
        type="button"
        onClick={address ? handleDisconnect : handleOpenModal}
        className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition ${
          address
            ? 'border-white/20 bg-white/[0.08] text-white hover:border-white hover:text-white'
            : 'border-[#6EA8FF] bg-[#6EA8FF] text-[#0A0F1C] hover:shadow-[0_0_18px_rgba(110,168,255,0.3)]'
        } ${className ?? ''}`.trim()}
      >
        {address ? `Disconnect ${buttonLabel}` : buttonLabel}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070C]/80 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[rgba(10,15,26,0.95)] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-brand text-2xl font-semibold text-white">Connect your wallet</h2>
                <p className="mt-1 font-ui text-sm text-[#B0B9C7]">
                  MetaMask and Rabby connect directly. Bifrost and Xaman support is rolling out via QR flows.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 transition hover:border-white hover:text-white"
              >
                Close
              </button>
            </div>

            <ul className="mt-6 space-y-3">
              {WALLET_OPTIONS.map((option) => {
                if (option.type === 'connector') {
                  const connector = connectors.find((item) => item.id === option.connectorId);
                  const disabled = !connector || isPending;
                  return (
                    <li key={option.id}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleConnect(option.connectorId)}
                        className={`w-full rounded-2xl border px-5 py-4 text-left transition ${
                          disabled
                            ? 'border-white/10 bg-white/[0.03] text-white/40'
                            : 'border-white/15 bg-white/[0.06] text-white hover:border-[#6EA8FF]/50 hover:bg-[#6EA8FF]/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-brand text-lg font-semibold text-white">{option.label}</p>
                            <p className="font-ui text-xs text-[#B0B9C7]">{option.description}</p>
                          </div>
                          {isPending && <span className="font-ui text-xs text-[#6EA8FF]">Connecting…</span>}
                        </div>
                      </button>
                    </li>
                  );
                }

                if (option.type === 'external') {
                  return (
                    <li key={option.id}>
                      <a
                        href={option.href}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition hover:border-[#6EA8FF]/40 hover:bg-[#6EA8FF]/10"
                      >
                        <p className="font-brand text-lg font-semibold text-white">{option.label}</p>
                        <p className="font-ui text-xs text-[#B0B9C7]">{option.description}</p>
                      </a>
                    </li>
                  );
                }

                return (
                  <li key={option.id}>
                    <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                      <p className="font-brand text-lg font-semibold text-white/60">{option.label}</p>
                      <p className="font-ui text-xs text-[#748199]">{option.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            {(localError || connectError) && (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 font-ui text-xs text-red-200">
                {localError ?? connectError?.message}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
