/**
 * Calculate Impermanent Loss (IL) for a liquidity pool position
 * 
 * IL compares the current value of LP tokens vs simply holding the tokens
 * 
 * Formula:
 * IL = (Value as LP / Value if Held) - 1
 * 
 * Where:
 * - Value as LP = Current TVL in the pool
 * - Value if Held = Initial token amounts × current prices
 */

export interface ImpermanentLossInput {
  // Initial deposit (at pool creation)
  initialAmount0: number;      // Amount of token0 deposited
  initialAmount1: number;      // Amount of token1 deposited
  initialPrice0Usd: number;    // USD price of token0 at deposit
  initialPrice1Usd: number;    // USD price of token1 at deposit
  
  // Current state
  currentPrice0Usd: number;    // Current USD price of token0
  currentPrice1Usd: number;    // Current USD price of token1
  currentTvlUsd: number;       // Current TVL in the pool
}

export interface ImpermanentLossResult {
  ilPercentage: number;        // IL as percentage (negative = loss)
  ilUsd: number;              // IL in USD
  valueAsLp: number;          // Current value in LP
  valueIfHeld: number;        // Value if tokens were held
  priceRatioChange: number;   // How much the price ratio changed
}

/**
 * Calculate Impermanent Loss
 */
export function calculateImpermanentLoss(input: ImpermanentLossInput): ImpermanentLossResult {
  const {
    initialAmount0,
    initialAmount1,
    initialPrice0Usd,
    initialPrice1Usd,
    currentPrice0Usd,
    currentPrice1Usd,
    currentTvlUsd,
  } = input;

  // Value if held = initial amounts × current prices
  const valueIfHeld = (initialAmount0 * currentPrice0Usd) + (initialAmount1 * currentPrice1Usd);

  // Value as LP = current TVL
  const valueAsLp = currentTvlUsd;

  // IL in USD
  const ilUsd = valueAsLp - valueIfHeld;

  // IL as percentage
  const ilPercentage = valueIfHeld > 0 ? (ilUsd / valueIfHeld) * 100 : 0;

  // Price ratio change
  const initialRatio = initialPrice0Usd / initialPrice1Usd;
  const currentRatio = currentPrice0Usd / currentPrice1Usd;
  const priceRatioChange = currentRatio / initialRatio;

  return {
    ilPercentage: isFinite(ilPercentage) ? ilPercentage : 0,
    ilUsd: isFinite(ilUsd) ? ilUsd : 0,
    valueAsLp,
    valueIfHeld,
    priceRatioChange: isFinite(priceRatioChange) ? priceRatioChange : 1,
  };
}

/**
 * Calculate theoretical IL based on price change (simplified formula)
 * This is useful when we don't have exact token amounts
 * 
 * IL = 2 × sqrt(price_ratio) / (1 + price_ratio) - 1
 */
export function calculateTheoreticalIL(priceRatio: number): number {
  if (!isFinite(priceRatio) || priceRatio <= 0) return 0;
  
  const il = 2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1;
  return isFinite(il) ? il * 100 : 0;
}

/**
 * Format IL for display
 */
export function formatIL(ilPercentage: number): string {
  if (!isFinite(ilPercentage)) return '--%';
  
  const sign = ilPercentage >= 0 ? '+' : '';
  
  if (Math.abs(ilPercentage) < 0.01) return '~0.00%';
  
  return `${sign}${ilPercentage.toFixed(2)}%`;
}

/**
 * Get IL color class based on percentage
 */
export function getILColorClass(ilPercentage: number): string {
  if (!isFinite(ilPercentage)) return 'text-liqui-subtext';
  if (ilPercentage >= 0) return 'text-green-400';
  if (ilPercentage > -1) return 'text-yellow-400';
  if (ilPercentage > -5) return 'text-orange-400';
  return 'text-red-400';
}

