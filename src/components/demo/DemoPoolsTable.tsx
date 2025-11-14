'use client';

import React from 'react';

import { PositionsTable, type PositionData } from '@/components/PositionsTable';
import { calcApr24h } from '@/lib/metrics';
import {
  getRangeWidthPct,
  getStrategy,
  type RangeStatus,
} from '@/components/pools/PoolRangeIndicator';
import { getTokenAsset } from '@/lib/assets';

const DEMO_ENDPOINT = '/api/demo/pools?limit=9&minTvl=150';
const DEFAULT_BADGE = 'Demo · generated from live prices';
const DEFAULT_DISCLAIMER = 'Not financial advice.';
const REQUIRED_TOKENS = ['FXRP', 'WFLR', 'SFLR', 'FLR'] as const;
const PROVIDER_TARGETS = ['enosys', 'sparkdex', 'blazeswap'] as const;
const STRATEGY_TARGETS: StrategyTone[] = ['aggressive', 'balanced', 'conservative'];
const STATUS_TARGETS: RangeStatus[] = ['in', 'near', 'out'];
const UNKNOWN_ICON = getTokenAsset('default');
const MAX_ITEMS = 9;
const APR_TOOLTIP = 'APR recomputed for consistency';
const REQUIRED_TOKEN_SET = new Set<string>(REQUIRED_TOKENS as readonly string[]);

type StrategyTone = ReturnType<typeof getStrategy>['tone'];

type DemoPoolsResponse = {
  ok: boolean;
  items: DemoPoolItem[];
  badgeLabel?: string;
  legal?: {
    disclaimer?: string;
  };
  warnings?: string[];
  placeholder?: boolean;
  error?: string;
};

type DemoPoolItem = {
  providerSlug: string;
  providerName: string;
  poolId: string;
  pairLabel: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Icon: string | null;
  token1Icon: string | null;
  feeTierBps: number;
  rangeMin: number;
  rangeMax: number;
  currentPrice: number;
  rangeWidthPct?: number;
  strategy?: StrategyTone;
  strategyLabel?: string;
  status: RangeStatus;
  tvlUsd: number;
  dailyFeesUsd: number;
  dailyIncentivesUsd: number;
  apr24hPct?: number;
  domain?: string;
  isDemo?: boolean;
  displayId?: string;
};

interface ExtendedItem extends DemoPoolItem {
  idKey: string;
  providerNormalized: string;
  tokens: string[];
  strategyTone: StrategyTone;
  statusTone: RangeStatus;
  qualityScore: number;
  isFlaro: boolean;
  fee0?: number;
  fee1?: number;
}

interface Availability {
  tokens: Set<string>;
  providers: Set<string>;
  strategies: Set<StrategyTone>;
  statuses: Set<RangeStatus>;
}

interface SelectionResult {
  selected: ExtendedItem[];
  warnings: string[];
}

interface DemoPoolsTableProps {
  onPositionsChange?: (positions: PositionData[]) => void;
}

export default function DemoPoolsTable({ onPositionsChange }: DemoPoolsTableProps = {}) {
  const [positions, setPositions] = React.useState<PositionData[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [badgeLabel, setBadgeLabel] = React.useState(DEFAULT_BADGE);
  const [disclaimer, setDisclaimer] = React.useState(DEFAULT_DISCLAIMER);
  const [noteIds, setNoteIds] = React.useState<string[]>([]);
  const [warning, setWarning] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(DEMO_ENDPOINT, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data: DemoPoolsResponse = await response.json();

        if (!data.ok || !Array.isArray(data.items) || data.placeholder) {
          throw new Error(data.error || 'Demo data unavailable right now.');
        }

        const selection = selectDemoPools(data.items, MAX_ITEMS);
        const mapped = mapToPositionData(selection.selected);
        const combinedWarnings = [...(data.warnings ?? []), ...selection.warnings];

        if (cancelled) {
          return;
        }

        setBadgeLabel(data.badgeLabel || DEFAULT_BADGE);
        setDisclaimer(data.legal?.disclaimer || DEFAULT_DISCLAIMER);
        setWarning(combinedWarnings.length > 0 ? combinedWarnings.join(' ') : null);
        setPositions(mapped.positions);
        setNoteIds(mapped.recomputedIds);
        onPositionsChange?.(mapped.positions);
      } catch (err) {
        if (cancelled) {
          return;
        }
        console.error('[DemoPoolsTable] Failed to load pools:', err);
        setError('Live demo temporarily unavailable. Try again in a moment.');
        setPositions(null);
        setNoteIds([]);
        setWarning(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!positions || noteIds.length === 0) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      noteIds.forEach((tokenId) => {
        const rows = document.querySelectorAll<HTMLElement>(`[data-pool-id="${tokenId}"]`);
        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll<HTMLElement>('[role="cell"]'));
          const aprCell = cells[4];
          const target = aprCell?.querySelector<HTMLElement>('.tnum');
          if (target) {
            target.setAttribute('title', APR_TOOLTIP);
          }
        });
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [positions, noteIds]);

  if (error) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
        <p className="font-ui text-sm text-red-300">{error}</p>
      </div>
    );
  }

  const isLoading = loading && !positions;

  return (
    <div className="relative space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h3 className="font-brand text-2xl font-semibold text-white sm:text-3xl">
            Explore live demo pools
          </h3>
          <p className="mt-3 font-ui text-sm leading-relaxed text-white/65 sm:text-base">
            Representative, real-time snapshots across Enosys, SparkDEX, and BlazeSwap. Values
            update continuously.
          </p>
        </div>
        <span className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/[0.08] px-3 py-1 font-ui text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-white/80">
          {badgeLabel}
        </span>
      </div>

      {warning && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 font-ui text-xs text-amber-100">
          <span className="font-semibold">Heads up:</span> {warning}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg bg-white/[0.05]" />
          ))}
        </div>
      ) : positions && positions.length > 0 ? (
        <PositionsTable positions={positions} hideClaimLink />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <p className="font-ui text-sm text-white/70">
            Live demo temporarily unavailable. Try again in a moment.
          </p>
        </div>
      )}

      <p className="font-ui text-xs text-white/45">{disclaimer}</p>
    </div>
  );
}

function selectDemoPools(items: DemoPoolItem[], limit: number): SelectionResult {
  const extended = items.map<ExtendedItem>((item) => {
    const tokens = [
      (item.token0Symbol || '').toUpperCase(),
      (item.token1Symbol || '').toUpperCase(),
    ];
    const providerNormalized = (item.providerSlug || '').toLowerCase();
    const strategyTone =
      item.strategy ??
      getStrategy(getRangeWidthPct(item.rangeMin, item.rangeMax)).tone ??
      'balanced';
    const statusTone = item.status ?? 'out';
    const qualityScore =
      (Number.isFinite(item.tvlUsd) ? item.tvlUsd : 0) * 1e6 +
      (item.dailyFeesUsd ?? 0) * 1e3 +
      (item.dailyIncentivesUsd ?? 0);
    const isFlaro =
      (item.domain && item.domain.toLowerCase().includes('flaro.org')) ||
      (item.pairLabel && item.pairLabel.toLowerCase().includes('flaro.org')) ||
      false;

    return {
      ...item,
      idKey: `${providerNormalized}:${item.poolId}`,
      providerNormalized,
      tokens,
      strategyTone,
      statusTone,
      qualityScore,
      isFlaro,
    };
  });

  const filtered = filterAndLimitFlaro(extended);
  const availability = buildAvailability(filtered);

  const selected: ExtendedItem[] = [];
  const remaining = [...filtered];

  const tryAdd = (predicate: (item: ExtendedItem) => boolean) => {
    const candidates = getCandidates(remaining, predicate);
    for (const candidate of candidates) {
      if (addCandidate(selected, remaining, candidate, limit, availability)) {
        removeFromRemaining(remaining, candidate);
        return true;
      }
    }
    return false;
  };

  // Token coverage
  REQUIRED_TOKENS.forEach((token) => {
    if (!availability.tokens.has(token)) return;
    if (selected.some((item) => item.tokens.includes(token))) return;
    tryAdd((item) => item.tokens.includes(token));
  });

  // Provider coverage
  PROVIDER_TARGETS.forEach((provider) => {
    if (!availability.providers.has(provider)) return;
    if (selected.some((item) => item.providerNormalized === provider)) return;
    tryAdd((item) => item.providerNormalized === provider);
  });

  // Strategy coverage
  STRATEGY_TARGETS.forEach((target) => {
    if (!availability.strategies.has(target)) return;
    if (selected.some((item) => item.strategyTone === target)) return;
    tryAdd((item) => item.strategyTone === target);
  });

  // Status coverage
  STATUS_TARGETS.forEach((target) => {
    if (!availability.statuses.has(target)) return;
    if (selected.some((item) => item.statusTone === target)) return;
    tryAdd((item) => item.statusTone === target);
  });

  // Fill remaining slots by quality
  const fillerCandidates = getCandidates(remaining, () => true);
  for (const candidate of fillerCandidates) {
    if (selected.length >= limit) break;
    if (addCandidate(selected, remaining, candidate, limit, availability)) {
      removeFromRemaining(remaining, candidate);
    }
  }

  trimToLimit(selected, limit, availability);

  const warnings = buildWarnings(selected, availability);

  return {
    selected,
    warnings,
  };
}

function mapToPositionData(items: ExtendedItem[]): { positions: PositionData[]; recomputedIds: string[] } {
  const recomputed: string[] = [];
  const positions = items.map((item) => {
    const tokenId = `${item.providerNormalized}-${item.poolId}`;
    const tvl = Math.max(item.tvlUsd ?? 0, 0);
    const dailyFees = Math.max(item.dailyFeesUsd ?? 0, 0);
    const dailyIncentives = Math.max(item.dailyIncentivesUsd ?? 0, 0);
    const aprCalc = calcApr24h({
      tvlUsd: tvl,
      dailyFeesUsd: dailyFees,
      dailyIncentivesUsd: dailyIncentives,
    });

    const apiApr = Number.isFinite(item.apr24hPct ?? NaN) ? (item.apr24hPct ?? 0) : 0;
    const denominator = aprCalc === 0 ? 1 : Math.abs(aprCalc);
    const diffRatio = Math.abs(aprCalc - apiApr) / denominator;
    const useCalc = aprCalc > 0 && (apiApr <= 0 || diffRatio > 0.2);

    if (useCalc) {
      recomputed.push(tokenId);
    }

    const aprValue = useCalc ? aprCalc : apiApr;
    const feesUsd = Number((dailyFees * 14).toFixed(2));
    const incentivesUsd = Number((dailyIncentives * 14).toFixed(2));
    const providerSlug = item.providerNormalized;
    const rewardsUsd = Number((feesUsd + incentivesUsd).toFixed(2));
    const poolFeeBps = Number.isFinite(item.feeTierBps) ? item.feeTierBps : 0;
    const isInRange = item.statusTone === 'in';
    const dex: PositionData['dex'] = providerSlug === 'sparkdex' ? 'sparkdex-v3' : 'enosys-v3';
    const pair = {
      symbol0: item.token0Symbol || 'TOKEN0',
      symbol1: item.token1Symbol || 'TOKEN1',
      feeBps: poolFeeBps,
    };
    const amountsUsd = {
      total: tvl,
      token0: tvl ? tvl / 2 : null,
      token1: tvl ? tvl / 2 : null,
    };

    return {
      tokenId,
      dex,
      poolAddress: item.poolId || tokenId,
      pair,
      liquidity: String(tvl ?? 0),
      amountsUsd,
      fees24hUsd: dailyFees,
      incentivesUsdPerDay: dailyIncentives,
      incentivesTokens: [],
      status: item.statusTone,
      claim: null,
      entitlements: {
        role: 'VISITOR' as const,
        flags: {
          premium: false,
          analytics: false,
        },
      },
      provider: providerSlug,
      dexName: item.providerName,
      marketId: item.poolId,
      poolId: item.poolId,
      poolFeeBps,
      tvlUsd: tvl,
      unclaimedFeesUsd: feesUsd,
      incentivesUsd,
      rewardsUsd,
      isInRange,
      token0: {
        symbol: item.token0Symbol || '',
        address: '',
      },
      token1: {
        symbol: item.token1Symbol || '',
        address: '',
      },
      token0Icon: ensureIcon(item.token0Icon),
      token1Icon: ensureIcon(item.token1Icon),
      rangeMin: item.rangeMin,
      rangeMax: item.rangeMax,
      liquidityShare: undefined,
      incentivesToken: incentivesUsd > 0 ? 'rFLR' : undefined,
      incentivesTokenAmount: incentivesUsd > 0 ? Math.round(incentivesUsd / 0.016) : undefined,
      currentPrice: item.currentPrice,
      apr24h: aprValue,
      dailyFeesUsd: dailyFees,
      dailyIncentivesUsd: dailyIncentives,
      category: (tvl > 0 ? 'Active' : 'Inactive') as 'Active' | 'Inactive' | 'Ended',
      isDemo: item.isDemo ?? true,
      displayId: item.displayId,
      // Note: fee0/fee1 from LIVE mode positions come from Position Manager
      fee0: item.fee0,
      fee1: item.fee1,
    };
  });

  return { positions, recomputedIds: recomputed };
}

function ensureIcon(icon: string | null | undefined): string {
  return icon && icon.length > 0 ? icon : UNKNOWN_ICON;
}

function filterAndLimitFlaro(items: ExtendedItem[]): ExtendedItem[] {
  const result: ExtendedItem[] = [];
  let flaroUsed = false;

  items.forEach((item) => {
    if (item.tvlUsd <= 0) {
      return;
    }

    if (item.providerNormalized === 'blazeswap' && item.isFlaro) {
      if (flaroUsed) {
        return;
      }
      flaroUsed = true;
    }

    result.push(item);
  });

  return result;
}

function buildAvailability(items: ExtendedItem[]): Availability {
  const availability: Availability = {
    tokens: new Set<string>(),
    providers: new Set<string>(),
    strategies: new Set<StrategyTone>(),
    statuses: new Set<RangeStatus>(),
  };

  items.forEach((item) => {
    item.tokens.forEach((token) => {
      if (REQUIRED_TOKEN_SET.has(token)) {
        availability.tokens.add(token);
      }
    });
    availability.providers.add(item.providerNormalized);
    availability.strategies.add(item.strategyTone);
    availability.statuses.add(item.statusTone);
  });

  return availability;
}

function getCandidates(
  items: ExtendedItem[],
  predicate: (item: ExtendedItem) => boolean,
): { item: ExtendedItem }[] {
  return items
    .filter((item) => predicate(item))
    .map((item) => ({ item }))
    .sort((a, b) => b.item.qualityScore - a.item.qualityScore);
}

function addCandidate(
  selected: ExtendedItem[],
  remaining: ExtendedItem[],
  candidateWrapper: { item: ExtendedItem },
  limit: number,
  availability: Availability,
): boolean {
  const candidate = candidateWrapper.item;

  if (selected.some((item) => item.idKey === candidate.idKey)) {
    return false;
  }

  if (selected.length < limit) {
    selected.push(candidate);
    return true;
  }

  const combined = [...selected, candidate];
  const candidateIndex = combined.length - 1;
  const removalIndex = chooseRemovalIndex(combined, candidateIndex, limit, availability);

  if (removalIndex === -1) {
    return false;
  }

  const removed = combined.splice(removalIndex, 1)[0];

  if (removed.idKey === candidate.idKey) {
    return false;
  }

  selected.splice(0, selected.length, ...combined);
  if (!remaining.some((item) => item.idKey === removed.idKey)) {
    remaining.push(removed);
  }
  return true;
}

function removeFromRemaining(remaining: ExtendedItem[], candidateWrapper: { item: ExtendedItem }) {
  const index = remaining.findIndex((entry) => entry.idKey === candidateWrapper.item.idKey);
  if (index !== -1) {
    remaining.splice(index, 1);
  }
}

function chooseRemovalIndex(
  combined: ExtendedItem[],
  candidateIndex: number,
  limit: number,
  availability: Availability,
): number {
  const scored = combined
    .map((item, index) => ({ index, quality: item.qualityScore }))
    .sort((a, b) => a.quality - b.quality);

  for (const { index } of scored) {
    if (combined.length - 1 < limit) {
      break;
    }

    if (index === candidateIndex) {
      continue;
    }

    const next = combined.filter((_, idx) => idx !== index);
    if (checkCoverage(next, availability)) {
      return index;
    }
  }

  return -1;
}

function trimToLimit(selected: ExtendedItem[], limit: number, availability: Availability) {
  while (selected.length > limit) {
    const scored = selected
      .map((item, index) => ({ index, quality: item.qualityScore }))
      .sort((a, b) => a.quality - b.quality);

    let removed = false;
    for (const { index } of scored) {
      const next = selected.filter((_, idx) => idx !== index);
      if (next.length < limit) {
        continue;
      }
      if (checkCoverage(next, availability)) {
        selected.splice(index, 1);
        removed = true;
        break;
      }
    }

    if (!removed) {
      break;
    }
  }
}

function checkCoverage(items: ExtendedItem[], availability: Availability): boolean {
  if (items.length === 0) {
    return false;
  }

  for (const token of availability.tokens) {
    if (!items.some((item) => item.tokens.includes(token))) {
      return false;
    }
  }

  for (const provider of PROVIDER_TARGETS) {
    if (!availability.providers.has(provider)) {
      continue;
    }
    if (!items.some((item) => item.providerNormalized === provider)) {
      return false;
    }
  }

  for (const strategy of STRATEGY_TARGETS) {
    if (!availability.strategies.has(strategy)) {
      continue;
    }
    if (!items.some((item) => item.strategyTone === strategy)) {
      return false;
    }
  }

  for (const status of STATUS_TARGETS) {
    if (!availability.statuses.has(status)) {
      continue;
    }
    if (!items.some((item) => item.statusTone === status)) {
      return false;
    }
  }

  const flaroCount = items.filter(
    (item) => item.providerNormalized === 'blazeswap' && item.isFlaro,
  ).length;
  if (flaroCount > 1) {
    return false;
  }

  return true;
}

function buildWarnings(selected: ExtendedItem[], availability: Availability): string[] {
  const warnings: string[] = [];

  const missingTokens = Array.from(availability.tokens).filter(
    (token) => !selected.some((item) => item.tokens.includes(token)),
  );
  if (missingTokens.length > 0) {
    warnings.push(`Token mix limited this hour (missing ${missingTokens.join(', ')}).`);
  }

  const missingProviders = PROVIDER_TARGETS.filter(
    (provider) =>
      availability.providers.has(provider) &&
      !selected.some((item) => item.providerNormalized === provider),
  );
  if (missingProviders.length > 0) {
    warnings.push(`Provider spread limited: missing ${missingProviders.join(', ')}.`);
  }

  const missingStrategies = STRATEGY_TARGETS.filter(
    (strategy) =>
      availability.strategies.has(strategy) &&
      !selected.some((item) => item.strategyTone === strategy),
  );
  if (missingStrategies.length > 0) {
    warnings.push(
      `Strategy mix limited: missing ${missingStrategies
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(', ')}.`,
    );
  }

  const missingStatuses = STATUS_TARGETS.filter(
    (status) =>
      availability.statuses.has(status) &&
      !selected.some((item) => item.statusTone === status),
  );
  if (missingStatuses.length > 0) {
    warnings.push(
      `Range status mix limited: missing ${missingStatuses
        .map((status) => status.charAt(0).toUpperCase() + status.slice(1))
        .join(', ')}.`,
    );
  }

  return warnings;
}
