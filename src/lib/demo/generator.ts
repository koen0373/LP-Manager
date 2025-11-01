import { getPairMidPrice } from '@/lib/prices/oracles';
import { calcApr24h } from '@/lib/metrics';
import {
  getRangeStatus,
  getRangeWidthPct,
  getStrategy,
  RangeStatus,
  RangeStrategyResult,
} from '@/components/pools/PoolRangeIndicator';

type ProviderSlug = 'enosys' | 'sparkdex' | 'blazeswap';
type StrategyTone = RangeStrategyResult['tone'];

interface PoolTemplate {
  id: string;
  providerSlug: ProviderSlug;
  providerName: string;
  pair: [string, string];
  feeBps: number;
  targetStrategy: StrategyTone;
  targetStatus: RangeStatus;
  baseTvl: number;
  domain?: string;
}

interface BuildContext {
  rng: () => number;
  minTvl: number;
  seed: string;
  variant: number;
}

export interface SimulatedPool {
  templateId: string;
  providerSlug: ProviderSlug;
  providerName: string;
  poolId: string;
  pairLabel: string;
  token0Symbol: string;
  token1Symbol: string;
  feeTierBps: number;
  rangeMin: number;
  rangeMax: number;
  currentPrice: number;
  rangeWidthPct: number;
  strategy: StrategyTone;
  strategyLabel: RangeStrategyResult['label'];
  status: RangeStatus;
  tvlUsd: number;
  dailyFeesUsd: number;
  dailyIncentivesUsd: number;
  apr24hPct: number;
  domain?: string;
}

export interface DiversityReport {
  valid: boolean;
  strategies: string[];
  statuses: string[];
  providers: string[];
  warnings: string[];
  counts: {
    enosys: number;
    sparkdex: number;
    blazeswap: number;
    flaroTagged: number;
  };
}

export interface GenerationResult {
  seed: string;
  generatedAt: string;
  pools: SimulatedPool[];
  diversity: DiversityReport;
}

const WIDTH_BY_STRATEGY: Record<StrategyTone, { min: number; max: number }> = {
  aggressive: { min: 8, max: 12 },
  balanced: { min: 14, max: 32 },
  conservative: { min: 36, max: 78 },
};

const FEE_RATE_BY_STRATEGY: Record<StrategyTone, { min: number; max: number }> = {
  aggressive: { min: 0.004, max: 0.0075 }, // 0.40% – 0.75% daily
  balanced: { min: 0.0015, max: 0.0035 }, // 0.15% – 0.35% daily
  conservative: { min: 0.0004, max: 0.0012 }, // 0.04% – 0.12% daily
};

const STATUS_FEE_MULTIPLIER: Record<RangeStatus, number> = {
  in: 1,
  near: 0.65,
  out: 0.12,
};

/**
 * Incentive ratios are now based on TVL tiers, not status.
 * Smaller pools get HIGHER incentive ratios to attract LPs.
 * Returns ratio relative to TVL (not fees!).
 */
function getIncentiveRatio(tvlUsd: number, strategy: StrategyTone): number {
  // Base multiplier by strategy
  const strategyMultiplier: Record<StrategyTone, number> = {
    aggressive: 1.4, // Higher rewards for narrow ranges
    balanced: 1.0,
    conservative: 0.6, // Lower rewards for wide ranges
  };
  
  // TVL tier multipliers (inverse relationship: smaller = higher incentives)
  if (tvlUsd < 5000) {
    // Small pools: incentives often EXCEED fees
    return 0.008 * strategyMultiplier[strategy]; // ~0.8% daily
  } else if (tvlUsd < 20000) {
    // Medium pools: incentives ~50-80% of fees
    return 0.004 * strategyMultiplier[strategy]; // ~0.4% daily
  } else if (tvlUsd < 100000) {
    // Large pools: incentives ~30-50% of fees
    return 0.002 * strategyMultiplier[strategy]; // ~0.2% daily
  } else {
    // Whale pools: incentives ~10-20% of fees
    return 0.0008 * strategyMultiplier[strategy]; // ~0.08% daily
  }
}

const PROVIDER_NAMES: Record<ProviderSlug, string> = {
  enosys: 'Enosys v3',
  sparkdex: 'SparkDEX v2',
  blazeswap: 'BlazeSwap v3',
};

const POOL_TEMPLATES: PoolTemplate[] = [
  // Enosys - Diverse TVL range (€500 - €200K)
  // Small pools (€500 - €5K) - voor beginners
  {
    id: 'enosys-hln-wflr-small',
    providerSlug: 'enosys',
    providerName: PROVIDER_NAMES.enosys,
    pair: ['HLN', 'WFLR'],
    feeBps: 30,
    targetStrategy: 'aggressive',
    targetStatus: 'in',
    baseTvl: 1200,
  },
  {
    id: 'enosys-usdt0-aps-small',
    providerSlug: 'enosys',
    providerName: PROVIDER_NAMES.enosys,
    pair: ['USD₮0', 'APS'],
    feeBps: 30,
    targetStrategy: 'balanced',
    targetStatus: 'near',
    baseTvl: 2400,
  },
  // Medium pools (€5K - €20K) - voor actieve LPs
  {
    id: 'enosys-hln-fxrp-med',
    providerSlug: 'enosys',
    providerName: PROVIDER_NAMES.enosys,
    pair: ['HLN', 'FXRP'],
    feeBps: 30,
    targetStrategy: 'aggressive',
    targetStatus: 'near',
    baseTvl: 8500,
  },
  {
    id: 'enosys-hln-usdt0-med',
    providerSlug: 'enosys',
    providerName: PROVIDER_NAMES.enosys,
    pair: ['HLN', 'USD₮0'],
    feeBps: 30,
    targetStrategy: 'balanced',
    targetStatus: 'in',
    baseTvl: 14200,
  },
  {
    id: 'enosys-sflr-wflr-med',
    providerSlug: 'enosys',
    providerName: PROVIDER_NAMES.enosys,
    pair: ['SFLR', 'WFLR'],
    feeBps: 5,
    targetStrategy: 'conservative',
    targetStatus: 'in',
    baseTvl: 18900,
  },
  // Large pools (€20K - €100K) - voor serieuze LPs
  {
    id: 'enosys-wflr-usdcsg-large',
    providerSlug: 'enosys',
    providerName: PROVIDER_NAMES.enosys,
    pair: ['WFLR', 'USDC.e'],
    feeBps: 30,
    targetStrategy: 'balanced',
    targetStatus: 'in',
    baseTvl: 42000,
  },
  {
    id: 'enosys-fxrp-usdt0-large',
    providerSlug: 'enosys',
    providerName: PROVIDER_NAMES.enosys,
    pair: ['FXRP', 'USD₮0'],
    feeBps: 30,
    targetStrategy: 'balanced',
    targetStatus: 'near',
    baseTvl: 68000,
  },
  {
    id: 'enosys-wflr-fxrp-large',
    providerSlug: 'enosys',
    providerName: PROVIDER_NAMES.enosys,
    pair: ['WFLR', 'FXRP'],
    feeBps: 30,
    targetStrategy: 'aggressive',
    targetStatus: 'in',
    baseTvl: 85000,
  },
  // Whale pool (€100K - €250K) - 1 uitschieter
  {
    id: 'enosys-wflr-usdt0-whale',
    providerSlug: 'enosys',
    providerName: PROVIDER_NAMES.enosys,
    pair: ['WFLR', 'USD₮0'],
    feeBps: 30,
    targetStrategy: 'balanced',
    targetStatus: 'in',
    baseTvl: 180000,
  },
  // Extra Enosys pool voor diversity
  {
    id: 'enosys-usdt0-usdcsg',
    providerSlug: 'enosys',
    providerName: PROVIDER_NAMES.enosys,
    pair: ['USD₮0', 'USDC.e'],
    feeBps: 1,
    targetStrategy: 'conservative',
    targetStatus: 'in',
    baseTvl: 32000,
  },
  // SparkDEX - medium pools voor provider diversity
  {
    id: 'sparkdex-fxrp-wflr',
    providerSlug: 'sparkdex',
    providerName: PROVIDER_NAMES.sparkdex,
    pair: ['FXRP', 'WFLR'],
    feeBps: 30,
    targetStrategy: 'aggressive',
    targetStatus: 'in',
    baseTvl: 12500,
  },
  {
    id: 'sparkdex-sflr-usdt0',
    providerSlug: 'sparkdex',
    providerName: PROVIDER_NAMES.sparkdex,
    pair: ['SFLR', 'USD₮0'],
    feeBps: 30,
    targetStrategy: 'balanced',
    targetStatus: 'near',
    baseTvl: 25000,
  },
  // BlazeSwap - diverse sizes
  {
    id: 'blazeswap-wflr-usdt0',
    providerSlug: 'blazeswap',
    providerName: PROVIDER_NAMES.blazeswap,
    pair: ['WFLR', 'USD₮0'],
    feeBps: 30,
    targetStrategy: 'balanced',
    targetStatus: 'in',
    baseTvl: 38000,
  },
  {
    id: 'blazeswap-sflr-wflr',
    providerSlug: 'blazeswap',
    providerName: PROVIDER_NAMES.blazeswap,
    pair: ['SFLR', 'WFLR'],
    feeBps: 5,
    targetStrategy: 'conservative',
    targetStatus: 'near',
    baseTvl: 7800,
  },
];

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createSeededRng(seed: string): () => number {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

function getHourlySeed(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return `${year}${month}${day}${hour}`;
}

function _alignCurrentPrice(
  targetStatus: RangeStatus,
  rangeMin: number,
  rangeMax: number,
  rng: () => number,
): number {
  const width = Math.max(rangeMax - rangeMin, Number.EPSILON);
  switch (targetStatus) {
    case 'in':
      return rangeMin + width * randomBetween(rng, 0.25, 0.75);
    case 'near':
      if (rng() < 0.5) {
        return rangeMin + width * randomBetween(rng, 0.01, 0.05);
      }
      return rangeMax - width * randomBetween(rng, 0.01, 0.05);
    case 'out':
      if (rng() < 0.5) {
        return rangeMin * (1 - randomBetween(rng, 0.03, 0.1));
      }
      return rangeMax * (1 + randomBetween(rng, 0.03, 0.1));
    default:
      return rangeMin + width / 2;
  }
}

function buildPool(template: PoolTemplate, context: BuildContext): SimulatedPool {
  const { rng, minTvl, seed, variant } = context;

  // 1. Get the REAL current market price (this is the anchor)
  const baseMidPrice = getPairMidPrice(template.pair[0], template.pair[1]);
  const priceJitter = randomBetween(rng, -0.02, 0.02);
  const currentPrice = baseMidPrice * (1 + priceJitter);

  // 2. Determine range width based on target strategy
  const widthBounds = WIDTH_BY_STRATEGY[template.targetStrategy];
  const widthPct = randomBetween(rng, widthBounds.min, widthBounds.max);
  const halfWidthRatio = widthPct / 200;

  // 3. Calculate min/max around the current price
  let rangeMin = currentPrice * (1 - halfWidthRatio);
  let rangeMax = currentPrice * (1 + halfWidthRatio);

  if (!Number.isFinite(rangeMin) || rangeMin <= 0) {
    rangeMin = Math.abs(currentPrice) * 0.85;
  }

  if (!Number.isFinite(rangeMax) || rangeMax <= rangeMin) {
    rangeMax = rangeMin * (1 + widthPct / 100);
  }

  // 4. Adjust current price position based on target status
  // (move current price relative to the range to achieve desired status)
  let adjustedCurrent = currentPrice;
  const width = rangeMax - rangeMin;
  
  switch (template.targetStatus) {
    case 'in':
      // Keep current price in the center 50% of range
      adjustedCurrent = rangeMin + width * randomBetween(rng, 0.25, 0.75);
      break;
    case 'near':
      // Move current price close to a boundary (but still inside)
      if (rng() < 0.5) {
        adjustedCurrent = rangeMin + width * randomBetween(rng, 0.01, 0.05);
      } else {
        adjustedCurrent = rangeMax - width * randomBetween(rng, 0.01, 0.05);
      }
      break;
    case 'out':
      // Move current price outside the range
      if (rng() < 0.5) {
        adjustedCurrent = rangeMin * (1 - randomBetween(rng, 0.03, 0.1));
      } else {
        adjustedCurrent = rangeMax * (1 + randomBetween(rng, 0.03, 0.1));
      }
      break;
  }

  const status = getRangeStatus(adjustedCurrent, rangeMin, rangeMax);
  const rangeWidthPct = getRangeWidthPct(rangeMin, rangeMax);
  const strategyResult = getStrategy(rangeWidthPct);

  const baseTvl = Math.max(template.baseTvl, minTvl);
  const tvlMultiplier = randomBetween(rng, 0.92, 1.18);
  const tvlUsd = Number(Math.max(minTvl, baseTvl * tvlMultiplier).toFixed(2));

  const feeRateBounds = FEE_RATE_BY_STRATEGY[template.targetStrategy];
  const feeRate = randomBetween(rng, feeRateBounds.min, feeRateBounds.max);
  const dailyFeesRaw = tvlUsd * feeRate * STATUS_FEE_MULTIPLIER[status];
  const dailyFeesUsd = Number(Math.max(0, dailyFeesRaw).toFixed(2));

  // NEW: Calculate incentives based on TVL tier and strategy (not fees!)
  const incentiveRate = getIncentiveRatio(tvlUsd, strategyResult.tone);
  const dailyIncentivesRaw = tvlUsd * incentiveRate;
  const dailyIncentivesUsd = Number(Math.max(0, dailyIncentivesRaw).toFixed(2));

  const apr24h = calcApr24h({
    tvlUsd,
    dailyFeesUsd,
    dailyIncentivesUsd,
  });

  const uniqueSuffix = variant > 0 ? `-${variant}` : '';
  const poolId = `${template.providerSlug}-${template.id.split('-').slice(-1)[0]}-${seed.slice(-3)}${uniqueSuffix}`;

  return {
    templateId: template.id,
    providerSlug: template.providerSlug,
    providerName: template.providerName,
    poolId,
    pairLabel: `${template.pair[0]} / ${template.pair[1]}`,
    token0Symbol: template.pair[0],
    token1Symbol: template.pair[1],
    feeTierBps: template.feeBps,
    rangeMin: Number(rangeMin.toFixed(6)),
    rangeMax: Number(rangeMax.toFixed(6)),
    currentPrice: Number(adjustedCurrent.toFixed(6)),
    rangeWidthPct: Number(rangeWidthPct.toFixed(2)),
    strategy: strategyResult.tone,
    strategyLabel: strategyResult.label,
    status,
    tvlUsd,
    dailyFeesUsd,
    dailyIncentivesUsd,
    apr24hPct: Number(apr24h.toFixed(2)),
    domain: template.domain,
  };
}

function computeDiversity(pools: SimulatedPool[]): DiversityReport {
  const strategies = new Set<StrategyTone>();
  const statuses = new Set<RangeStatus>();
  const providers = new Set<ProviderSlug>();
  let blazeswap = 0;
  let enosys = 0;
  let sparkdex = 0;
  let flaroTagged = 0;

  pools.forEach((pool) => {
    strategies.add(pool.strategy);
    statuses.add(pool.status);
    providers.add(pool.providerSlug);
    if (pool.providerSlug === 'blazeswap') blazeswap += 1;
    if (pool.providerSlug === 'enosys') enosys += 1;
    if (pool.providerSlug === 'sparkdex') sparkdex += 1;
    if (pool.domain === 'flaro.org') flaroTagged += 1;
  });

  const warnings: string[] = [];
  if (strategies.size < 3) warnings.push(`Only ${strategies.size}/3 strategies present`);
  if (statuses.size < 3) warnings.push(`Only ${statuses.size}/3 range statuses present`);
  if (!providers.has('enosys')) warnings.push('Missing Enosys coverage');
  if (!providers.has('sparkdex')) warnings.push('Missing SparkDEX coverage');
  if (blazeswap > 3) warnings.push('BlazeSwap limit exceeded (>3)');
  if (flaroTagged > 1) warnings.push('More than one flaro.org pool generated');

  const valid =
    strategies.size >= 3 &&
    statuses.size >= 3 &&
    providers.has('enosys') &&
    providers.has('sparkdex') &&
    blazeswap <= 3 &&
    flaroTagged <= 1;

  return {
    valid,
    strategies: Array.from(strategies),
    statuses: Array.from(statuses),
    providers: Array.from(providers),
    warnings,
    counts: {
      enosys,
      sparkdex,
      blazeswap,
      flaroTagged,
    },
  };
}

function filterByProviders(templates: PoolTemplate[], providers?: string[]): PoolTemplate[] {
  if (!providers || providers.length === 0) {
    return templates;
  }
  const allow = new Set(providers.map((p) => p.trim().toLowerCase()));
  const filtered = templates.filter((tpl) => allow.has(tpl.providerSlug));
  return filtered.length > 0 ? filtered : templates;
}

export interface GenerateOptions {
  limit?: number;
  minTvl?: number;
  providers?: string[];
  timestamp?: Date;
}

export function generateSimulatedPools(options: GenerateOptions = {}): GenerationResult {
  const {
    limit = 9,
    minTvl = 150,
    providers,
    timestamp = new Date(),
  } = options;

  const seed = getHourlySeed(timestamp);
  const rng = createSeededRng(seed);
  const allowedTemplates = filterByProviders(POOL_TEMPLATES, providers);

  const pools: SimulatedPool[] = [];
  const variantCount: Record<string, number> = {};

  let cursor = 0;
  // Ensure we always generate enough pools, repeating templates (with variants) when needed.
  while (pools.length < limit && cursor < limit * 5) {
    const template = allowedTemplates[cursor % allowedTemplates.length];
    cursor += 1;

    if (!template) break;

    const templateKey = template.id;
    const currentVariant = variantCount[templateKey] ?? 0;

    if (template.domain === 'flaro.org' && currentVariant >= 1) {
      // Skip additional flaro.org variants to honour cap
      continue;
    }

    const pool = buildPool(template, {
      rng,
      minTvl,
      seed,
      variant: currentVariant,
    });

    pools.push(pool);
    variantCount[templateKey] = currentVariant + 1;
  }

  const trimmed = pools.slice(0, limit);
  const diversity = computeDiversity(trimmed);

  return {
    seed,
    generatedAt: timestamp.toISOString(),
    pools: trimmed,
    diversity,
  };
}
