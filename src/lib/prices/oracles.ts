/**
 * Lightweight price oracle helpers for the simulated demo flow.
 *
 * Approach:
 * - Use seeded static price anchors for core Flare ecosystem tokens.
 * - Allow environment overrides via `DEMO_PRICE_<SYMBOL>` or `DEMO_PRICE_<A>_<B>`
 *   so ops can sync the demo with external data feeds if desired.
 * - Keep implementation dependency-free; future DEX adapters can plug in here.
 */

type TokenSymbol = string;

const DEFAULT_TOKEN_PRICES_USD: Record<string, number> = {
  FXRP: 2.46,  // Flare XRP - updated to current price
  WFLR: 0.0165,
  FLR: 0.0165,
  SFLR: 0.0178,
  HLN: 0.000095,  // Holon
  APS: 0.00012,   // Apollo
  'USD0': 1,
  'USDT0': 1,
  'USDCE': 1,  // USDC.e (Ethereum bridged USDC)
  'USDCSG': 1, // USDC (SG)
};

/**
 * Normalise token symbols for lookup / env keys.
 * - Uppercase everything.
 * - Replace unicode `₮` with ASCII `T`.
 * - Replace subscript zero `₀` with ASCII `0`.
 */
function normalizeSymbol(symbol: TokenSymbol): string {
  return symbol
    .toUpperCase()
    .replaceAll('₮', 'T')
    .replaceAll('₀', '0');
}

function parseNumber(envValue: string | undefined): number | null {
  if (!envValue) return null;
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

/**
 * Retrieve a USD price for a single token symbol.
 * Falls back to defaults when no overrides are provided.
 */
export function getTokenPriceUsd(symbol: TokenSymbol): number {
  const normalized = normalizeSymbol(symbol);
  const override = parseNumber(process.env[`DEMO_PRICE_${normalized}`]);
  if (override) return override;

  const base = DEFAULT_TOKEN_PRICES_USD[normalized];
  if (base) return base;

  // Unknown tokens default to parity with USD; keep deterministic.
  return 1;
}

/**
 * Determine the mid price for a pair (token0 priced in token1 units).
 * Logic:
 * 1) Look for explicit override: DEMO_PRICE_<A>_<B>
 * 2) Fallback to ratio of individual token USD anchors.
 */
export function getPairMidPrice(token0: TokenSymbol, token1: TokenSymbol): number {
  const a = normalizeSymbol(token0);
  const b = normalizeSymbol(token1);

  const directKey = `DEMO_PRICE_${a}_${b}`;
  const reverseKey = `DEMO_PRICE_${b}_${a}`;

  const directOverride = parseNumber(process.env[directKey]);
  if (directOverride) {
    return directOverride;
  }

  const reverseOverride = parseNumber(process.env[reverseKey]);
  if (reverseOverride) {
    // reciprocal when only reverse provided
    return reverseOverride !== 0 ? 1 / reverseOverride : 1;
  }

  const price0 = getTokenPriceUsd(a);
  const price1 = getTokenPriceUsd(b);

  if (!Number.isFinite(price0) || !Number.isFinite(price1) || price1 === 0) {
    return 1;
  }

  return price0 / price1;
}

export interface PairPriceSnapshot {
  token0: TokenSymbol;
  token1: TokenSymbol;
  ratio: number;
  timestamp: string;
  source: 'static' | 'env';
}

/**
 * Helper for diagnostics / logging.
 */
export function getPairPriceSnapshot(token0: TokenSymbol, token1: TokenSymbol): PairPriceSnapshot {
  const a = normalizeSymbol(token0);
  const b = normalizeSymbol(token1);
  const directKey = `DEMO_PRICE_${a}_${b}`;
  const reverseKey = `DEMO_PRICE_${b}_${a}`;

  const source = process.env[directKey] || process.env[reverseKey] ? 'env' : 'static';

  return {
    token0,
    token1,
    ratio: getPairMidPrice(token0, token1),
    timestamp: new Date().toISOString(),
    source,
  };
}
