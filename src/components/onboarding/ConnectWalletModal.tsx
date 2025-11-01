import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useConnect, useAccount } from 'wagmi';
import { toChecksummed } from '@/utils/route';

type Brand = 'metamask' | 'brave' | 'rabby' | 'okx' | 'phantom' | 'walletconnect';

function useBrandAvailability() {
  const [ready, setReady] = useState<Record<Brand, boolean>>({
    metamask: false,
    brave: false,
    rabby: false,
    okx: false,
    phantom: false,
    walletconnect: true,
  });

  useEffect(() => {
    const w = window as Window & { 
      ethereum?: { 
        isMetaMask?: boolean;
        isBraveWallet?: boolean;
        isRabby?: boolean;
        isOkxWallet?: boolean;
        isPhantom?: boolean;
      };
      okxwallet?: unknown;
      phantom?: { ethereum?: unknown };
    };
    const eth = w.ethereum;
    setReady({
      metamask: !!(eth && eth.isMetaMask),
      brave: !!(eth && eth.isBraveWallet),
      rabby: !!(eth && eth.isRabby),
      okx: !!(w.okxwallet || (eth && eth.isOkxWallet)),
      phantom: !!(w.phantom?.ethereum || (eth && eth.isPhantom)),
      walletconnect: true,
    });
  }, []);

  return ready;
}

export default function ConnectWalletModal() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect, connectors, status, error } = useConnect();

  const injectedConnector = useMemo(() => connectors.find((c) => c.id === 'injected'), [connectors]);
  const wcConnector = useMemo(() => connectors.find((c) => c.id === 'walletConnect'), [connectors]);

  const ready = useBrandAvailability();

  function connectInjected() {
    if (injectedConnector) connect({ connector: injectedConnector });
  }

  function connectWalletConnect() {
    if (wcConnector) connect({ connector: wcConnector });
  }

  const canContinue = isConnected && address;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: '1rem' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-[rgba(10,15,26,0.95)] p-6 backdrop-blur-xl"
        style={{ margin: 'auto', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-brand text-2xl text-white">Connect your wallet</h2>
        <p className="mt-1 font-ui text-sm text-white/70">Choose a wallet to connect to LiquiLab</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { brand: 'metamask', label: 'MetaMask', href: 'https://metamask.io' },
            { brand: 'phantom', label: 'Phantom', href: 'https://phantom.app' },
            { brand: 'okx', label: 'OKX Wallet', href: 'https://www.okx.com/web3' },
            { brand: 'brave', label: 'Brave Wallet', href: 'https://brave.com/wallet/' },
            { brand: 'rabby', label: 'Rabby', href: 'https://rabby.io' },
          ].map((w) => {
            const enabled = ready[w.brand as Brand];
            return (
              <button
                key={w.brand}
                onClick={enabled ? connectInjected : undefined}
                disabled={!enabled}
                aria-disabled={!enabled}
                className={[
                  'rounded-xl border border-white/15 px-4 py-3 text-left font-ui text-sm transition',
                  enabled
                    ? 'bg-white/10 text-white hover:bg-white/15'
                    : 'cursor-not-allowed bg-white/[0.06] text-white/40',
                ].join(' ')}
                aria-label={enabled ? `Connect ${w.label}` : `Install ${w.label}`}
              >
                <div>{w.label}</div>
                {!enabled && (
                  <a
                    href={w.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-white/60 underline hover:text-white/80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Install
                  </a>
                )}
              </button>
            );
          })}

          {/* WalletConnect tile */}
          <button
            onClick={connectWalletConnect}
            disabled={!wcConnector}
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-left font-ui text-sm text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Connect via WalletConnect"
          >
            <div>WalletConnect</div>
            <div className="mt-1 text-xs text-white/60">QR with any compatible mobile wallet</div>
          </button>
        </div>

        <p className="mt-6 text-center font-ui text-xs text-white/50">
          Read-only access. No approvals needed.
        </p>

        {status === 'error' && error && (
          <p className="mt-3 text-center font-ui text-sm text-red-300">
            {String(error.message || 'Connection failed')}
          </p>
        )}

        {canContinue && (
          <div className="mt-6 flex justify-center">
            <a
              href={`/sales/offer?address=${toChecksummed(address!)}`}
              className="inline-flex items-center justify-center rounded-2xl bg-[#3B82F6] px-5 py-2.5 font-ui text-sm font-semibold text-white transition hover:bg-[#2563EB]"
              aria-label="Continue to your offer"
            >
              Continue
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
