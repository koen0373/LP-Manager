'use client';

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { isAddress } from 'viem';
import { useAccount, useConnect } from 'wagmi';

import { LiquiLabLogo } from '@/components/LiquiLabLogo';
import { PoolRowPreview } from '@/components/pools/PoolRowPreview';
import { Button } from '@/components/ui/Button';
import { PricePill } from '@/components/ui/PricePill';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import {
  ANNUAL_MULTIPLIER,
  FREE_POOLS,
  PRICE_PER_POOL_USD,
} from '@/data/subscriptionPlans';
import { track } from '@/lib/analytics';

type PreviewPool = React.ComponentProps<typeof PoolRowPreview>['pool'];

const MOCK_POOLS: PreviewPool[] = [
  {
    id: 'sparkdex-eth-usd0',
    provider: 'SparkDEX',
    displayId: 'SDX-304',
    pairLabel: 'wETH / USD₮0',
    feeTierBps: 500,
    rangeStatus: 'in',
  },
  {
    id: 'blazeswap-flr-usdc',
    provider: 'BlazeSwap',
    displayId: 'BLZ-118',
    pairLabel: 'wFLR / USDC',
    feeTierBps: 3000,
    rangeStatus: 'near',
  },
  {
    id: 'enosys-dflr-spark',
    provider: 'Enosys',
    displayId: 'NSY-992',
    pairLabel: 'dFLR / SPARK',
    feeTierBps: 1000,
    rangeStatus: 'out',
  },
];

function normalizeAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return isAddress(value) ? (value.toLowerCase() as `0x${string}`) : null;
  } catch {
    return null;
  }
}

export default function ConnectPage() {
  const { address, status, connector } = useAccount();
  const { connectors, connectAsync, isPending, error: connectError } = useConnect();

  const [manualInput, setManualInput] = React.useState('');
  const [previewAddress, setPreviewAddress] = React.useState<string | null>(null);
  const [pools, setPools] = React.useState<PreviewPool[]>([]);
  const [isFetchingPools, setIsFetchingPools] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [usedMockData, setUsedMockData] = React.useState(false);
  const [connectMessage, setConnectMessage] = React.useState<string | null>(null);

  const trackedWalletRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (
      status === 'connected' &&
      connector &&
      address &&
      trackedWalletRef.current !== address
    ) {
      trackedWalletRef.current = address;
      track('wallet_connected', { provider: connector.name });
    }
  }, [address, connector, status]);

  const effectiveAddress = React.useMemo(
    () => normalizeAddress(address) ?? normalizeAddress(previewAddress),
    [address, previewAddress],
  );

  const poolCount = pools.length;
  const totalCapacity = React.useMemo(() => {
    if (poolCount > 0) {
      return Math.max(FREE_POOLS, poolCount);
    }
    if (usedMockData) {
      return Math.max(FREE_POOLS, MOCK_POOLS.length);
    }
    return FREE_POOLS;
  }, [poolCount, usedMockData]);
  const paidPools = Math.max(0, totalCapacity - FREE_POOLS);
  const monthlyAmount = Number((paidPools * PRICE_PER_POOL_USD).toFixed(2));
  const annualAmount = Number(
    (paidPools * PRICE_PER_POOL_USD * ANNUAL_MULTIPLIER).toFixed(2),
  );
  const checkoutHref = React.useMemo(() => {
    const params = new URLSearchParams({
      desiredCapacity: String(totalCapacity),
    });
    return `/checkout?${params.toString()}`;
  }, [totalCapacity]);

  React.useEffect(() => {
    if (!effectiveAddress) {
      setPools([]);
      setFetchError(null);
      setUsedMockData(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function loadPools() {
      setIsFetchingPools(true);
      setFetchError(null);
      setUsedMockData(false);

      try {
        const response = await fetch(`/api/positions?address=${effectiveAddress}`, {
          method: 'GET',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }

        const data = (await response.json()) as PreviewPool[];
        if (!Array.isArray(data) || data.length === 0) {
          if (!cancelled) {
            setPools(MOCK_POOLS);
            setUsedMockData(true);
            track('pools_detected', { count: MOCK_POOLS.length, mocked: true });
          }
          return;
        }

        if (!cancelled) {
          setPools(data);
          track('pools_detected', { count: data.length });
        }
      } catch (error) {
        if (cancelled) return;
        setPools(MOCK_POOLS);
        setUsedMockData(true);
        setFetchError(
          error instanceof Error ? error.message : 'Unable to fetch pools right now.',
        );
        track('pools_detected', { count: MOCK_POOLS.length, mocked: true });
      } finally {
        if (!cancelled) {
          setIsFetchingPools(false);
        }
      }
    }

    loadPools();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [effectiveAddress]);

  const handleConnectClick = React.useCallback(async () => {
    setConnectMessage(null);
    const primaryConnector = connectors[0];
    if (!primaryConnector) {
      setConnectMessage('No browser wallet detected. Use the address preview instead.');
      return;
    }

    try {
      await connectAsync({ connector: primaryConnector });
      setConnectMessage(null);
    } catch (error) {
      setConnectMessage(
        error instanceof Error ? error.message : 'Unable to connect. Try manual preview.',
      );
    }
  }, [connectAsync, connectors]);

  const handleManualPreview = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const sanitized = normalizeAddress(manualInput);
      if (!sanitized) {
        setFetchError('Enter a valid wallet address (0x…).');
        return;
      }
      setFetchError(null);
      setConnectMessage(null);
      setPreviewAddress(sanitized);
    },
    [manualInput],
  );

  const handleFollowNow = React.useCallback(() => {
    track('follow_now_click', { suggested: totalCapacity });
  }, [totalCapacity]);

  return (
    <>
      <Head>
        <title>Connect wallet · LiquiLab</title>
      </Head>

      <div className="relative min-h-screen overflow-hidden text-white">
        <div className="page-bg" aria-hidden="true" />
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 pb-20 pt-10 sm:px-10">
          <header className="flex items-center justify-between">
            <LiquiLabLogo variant="full" size="sm" theme="dark" />
            <Link
              href="/login"
              className="text-sm font-semibold text-white/80 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
            >
              Sign in
            </Link>
          </header>

          <main className="mt-12 flex flex-col gap-12 sm:mt-16">
            <ProgressSteps current="connect" />

            <section className="rounded-3xl border border-white/10 bg-[rgba(10,15,26,0.82)] px-6 py-10 backdrop-blur-xl sm:px-10">
              <div className="flex flex-col gap-6">
                <div>
                  <h1 className="font-brand text-3xl font-semibold text-white sm:text-4xl">
                    Connect your wallet
                  </h1>
                  <p className="mt-2 text-sm uppercase tracking-[0.3em] text-white/30">
                    Read-only. No approvals.
                  </p>
                </div>

                <PricePill />

                <div className="flex flex-wrap items-center gap-4">
                  <Button onClick={handleConnectClick} loading={isPending || status === 'connecting'}>
                    Connect with MetaMask or Rabby
                  </Button>
                  <span className="text-xs text-white/50">
                    We never move funds or request approvals.
                  </span>
                </div>
                {connectError ? (
                  <p className="text-xs text-[#FFA500]">
                    {connectError.message}
                  </p>
                ) : null}
                {connectMessage ? (
                  <p className="text-xs text-[#FFA500]">{connectMessage}</p>
                ) : null}

                <form
                  onSubmit={handleManualPreview}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm backdrop-blur"
                >
                  <label htmlFor="wallet-address" className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                    Or preview via wallet address
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      id="wallet-address"
                      name="wallet-address"
                      value={manualInput}
                      onChange={(event) => setManualInput(event.target.value)}
                      placeholder="0x…"
                      className="h-11 flex-1 rounded-xl border border-white/20 bg-black/20 px-4 font-mono text-sm text-white placeholder:text-white/30 focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#60A5FA]/40"
                    />
                    <Button type="submit" variant="ghost" className="whitespace-nowrap">
                      Preview
                    </Button>
                  </div>
                  <p className="text-xs text-white/40">
                    Works with any Flare-compatible address.
                  </p>
                </form>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur">
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-white/60">
                      Discovery preview
                    </span>
                    <h2 className="font-brand text-2xl font-semibold text-white">
                      We can follow up to{' '}
                      <span className="tnum text-[#3B82F6]">
                        {totalCapacity}
                      </span>{' '}
                      pool{totalCapacity === 1 ? '' : 's'}
                    </h2>
                    {usedMockData ? (
                      <p className="text-xs text-white/40">
                        Showing sample pools while we look up your positions.
                      </p>
                    ) : null}
                    {fetchError ? (
                      <p className="text-xs text-[#FFA500]">
                        {fetchError}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-6 flex flex-col gap-3">
                    {(isFetchingPools && pools.length === 0
                      ? MOCK_POOLS
                      : pools.length > 0
                        ? pools.slice(0, 5)
                        : MOCK_POOLS
                    ).map((pool, index) => {
                      const key = pool.id ?? pool.displayId ?? `${pool.provider ?? 'pool'}-${index}`;
                      return <PoolRowPreview key={key} pool={pool} />;
                    })}
                  </div>

                  <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-white/70">
                      Detected:{' '}
                      <span className="tnum text-white">
                        {isFetchingPools ? '…' : poolCount}
                      </span>{' '}
                      · Free:{' '}
                      <span className="tnum text-white">{FREE_POOLS}</span> · Paid:{' '}
                      <span className="tnum text-white">{paidPools}</span>
                      {paidPools > 0 ? (
                        <>
                          {' '}
                          · Monthly:{' '}
                          <span className="tnum text-white">
                            ${monthlyAmount.toFixed(2)}
                          </span>{' '}
                          · Annual:{' '}
                          <span className="tnum text-white">
                            ${annualAmount.toFixed(2)}
                          </span>
                        </>
                      ) : null}
                    </div>
                    <Button
                      as="a"
                      href={checkoutHref}
                      onClick={handleFollowNow}
                      aria-label={
                        paidPools === 0
                          ? 'Review checkout with one free pool'
                          : `Follow now with ${totalCapacity} pool${
                              totalCapacity === 1 ? '' : 's'
                            } for $${monthlyAmount.toFixed(2)}/month`
                      }
                    >
                      Follow now
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
