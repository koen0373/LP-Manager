'use client';

import * as React from 'react';
import { formatUnits } from 'ethers/lib/utils';

import type {
  PairSnapshot,
  TokenMetadata,
  UserLpPosition,
} from '@/lib/blazeswap/read';
import {
  BLAZESWAP_ROUTER_ADDRESS,
  getAllowance,
} from '@/lib/blazeswap/client';

type PositionCardProps = {
  snapshot: PairSnapshot | null;
  tokens: {
    token0: TokenMetadata | null;
    token1: TokenMetadata | null;
  };
  position?: UserLpPosition | null;
  account?: string | null;
  onRefresh?: () => void;
};

function formatAmount(value: string, decimals: number, precision = 4): string {
  if (!value) return '0';
  try {
    const formatted = Number.parseFloat(
      formatUnits(BigInt(value), decimals),
    );
    if (Number.isNaN(formatted)) return '0';
    if (formatted === 0) return '0';
    if (formatted >= 1) {
      return formatted.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: precision,
      });
    }
    return formatted.toPrecision(precision);
  } catch {
    return '0';
  }
}

export function PositionCard({
  snapshot,
  tokens,
  position,
  account,
  onRefresh,
}: PositionCardProps) {
  const [allowances, setAllowances] = React.useState<{
    token0?: string;
    token1?: string;
    lp?: string;
  }>({});
  const [checking, setChecking] = React.useState(false);
  const connected = Boolean(account);

  React.useEffect(() => {
    let active = true;
    async function loadAllowances() {
      if (!account || !snapshot || !tokens.token0 || !tokens.token1) {
        setAllowances({});
        return;
      }
      setChecking(true);
      try {
        const [token0Allowance, token1Allowance, lpAllowance] = await Promise.all([
          getAllowance(tokens.token0.address, account, BLAZESWAP_ROUTER_ADDRESS),
          getAllowance(tokens.token1.address, account, BLAZESWAP_ROUTER_ADDRESS),
          getAllowance(snapshot.address, account, BLAZESWAP_ROUTER_ADDRESS),
        ]);
        if (!active) return;
        setAllowances({
          token0: token0Allowance.toString(),
          token1: token1Allowance.toString(),
          lp: lpAllowance.toString(),
        });
      } catch (error) {
        console.warn('[PositionCard] allowance check failed', error);
        if (!active) return;
        setAllowances({});
      } finally {
        if (active) setChecking(false);
      }
    }
    void loadAllowances();
    return () => {
      active = false;
    };
  }, [account, snapshot, tokens.token0, tokens.token1]);

  if (!snapshot || !tokens.token0 || !tokens.token1) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
        <p className="font-ui text-sm text-white/60">
          Select a BlazeSwap pair to inspect liquidity, balances, and manage your position.
        </p>
      </div>
    );
  }

  const sharePercent = position ? (position.shareBps / 100).toFixed(2) : '0.00';
  const reserve0Formatted = formatAmount(
    snapshot.reserve0,
    tokens.token0.decimals,
  );
  const reserve1Formatted = formatAmount(
    snapshot.reserve1,
    tokens.token1.decimals,
  );
  const amount0Formatted = position
    ? formatAmount(position.amount0, tokens.token0.decimals)
    : '0';
  const amount1Formatted = position
    ? formatAmount(position.amount1, tokens.token1.decimals)
    : '0';

  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.05] p-6">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="font-brand text-xl font-semibold text-white">
            {tokens.token0.symbol}/{tokens.token1.symbol}
          </h2>
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs font-semibold text-[#3B82F6] hover:text-white"
          >
            Refresh
          </button>
        </div>
        <p className="font-ui text-xs text-white/50">
          Pair address:{' '}
          <span className="font-mono text-white/70">{snapshot.address}</span>
        </p>
        <p className="font-ui text-xs text-white/50">
          LP token: {snapshot.lpSymbol} ({snapshot.lpDecimals} decimals)
        </p>
      </header>

      <section className="grid gap-3 rounded-xl border border-white/10 bg-black/30 p-4 sm:grid-cols-2">
        <div>
          <span className="font-ui text-xs uppercase tracking-[0.18em] text-white/40">
            Pool reserves
          </span>
          <p className="mt-2 font-brand text-sm text-white">
            {reserve0Formatted} {tokens.token0.symbol}
          </p>
          <p className="font-brand text-sm text-white">
            {reserve1Formatted} {tokens.token1.symbol}
          </p>
        </div>
        <div>
          <span className="font-ui text-xs uppercase tracking-[0.18em] text-white/40">
            Total supply
          </span>
          <p className="mt-2 font-brand text-sm text-white">
            {formatAmount(snapshot.totalSupply, snapshot.lpDecimals)} LP
          </p>
          <p className="font-ui text-xs text-white/40">
            Last updated block timestamp: {snapshot.blockTimestampLast}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
        <header className="flex items-center justify-between">
          <span className="font-brand text-sm font-semibold text-white">
            Your position
          </span>
          {!connected && (
            <span className="text-xs text-white/40">Connect wallet to load balances</span>
          )}
        </header>

        {connected && position ? (
          <dl className="mt-3 space-y-2 font-ui text-sm text-white/70">
            <div className="flex items-center justify-between">
              <dt>LP balance</dt>
              <dd>{formatAmount(position.lpBalance, snapshot.lpDecimals)} LP</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Pool share</dt>
              <dd>{sharePercent}%</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>{tokens.token0.symbol} exposure</dt>
              <dd>{amount0Formatted}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>{tokens.token1.symbol} exposure</dt>
              <dd>{amount1Formatted}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 font-ui text-sm text-white/50">
            {connected
              ? 'No LP position detected for this pair.'
              : 'Connect your wallet to inspect your BlazeSwap liquidity.'}
          </p>
        )}
      </section>

      {connected && (
        <section className="rounded-xl border border-white/10 bg-black/10 p-4">
          <header className="flex items-center justify-between">
            <span className="font-brand text-sm font-semibold text-white">
              Approvals
            </span>
            {checking && <span className="text-xs text-white/40">Checking…</span>}
          </header>
          <dl className="mt-3 space-y-2 font-ui text-xs text-white/60">
            <div className="flex items-center justify-between">
              <dt>{tokens.token0.symbol} → Router</dt>
              <dd className="font-mono text-[11px] text-white/70">
                {allowances.token0 ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>{tokens.token1.symbol} → Router</dt>
              <dd className="font-mono text-[11px] text-white/70">
                {allowances.token1 ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>LP → Router</dt>
              <dd className="font-mono text-[11px] text-white/70">
                {allowances.lp ?? '—'}
              </dd>
            </div>
          </dl>
          <p className="mt-2 font-ui text-[11px] text-white/40">
            Allowances update automatically after successful transactions. Approvals are handled
            just-in-time before add/remove operations.
          </p>
        </section>
      )}
    </div>
  );
}
