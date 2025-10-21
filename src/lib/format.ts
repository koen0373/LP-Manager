export function fmtUsd(amount: number): string {
  if (amount === 0) return '0.00';
  if (amount < 0.01) return '<0.01';
  if (amount < 1) return amount.toFixed(2);
  if (amount < 1000) return amount.toFixed(2);
  if (amount < 1000000) return (amount / 1000).toFixed(1) + 'K';
  return (amount / 1000000).toFixed(1) + 'M';
}

export function fmtAmt(amount: number): string {
  if (amount === 0) return '0';
  if (amount < 0.0001) return '<0.0001';
  if (amount < 1) return amount.toFixed(4);
  if (amount < 1000) return amount.toFixed(2);
  if (amount < 1000000) return (amount / 1000).toFixed(1) + 'K';
  return (amount / 1000000).toFixed(1) + 'M';
}

export function formatUsd(amount: number): string {
  return fmtUsd(amount);
}

export function formatPercent(value: number): string {
  if (value === 0) return '0%';
  if (value < 0.01) return '<0.01%';
  if (value < 1) return `${value.toFixed(2)}%`;
  if (value < 100) return `${value.toFixed(1)}%`;
  return `${value.toFixed(0)}%`;
}

export function formatPrice(price: number, decimals: number = 5): string {
  if (price === 0) return '0.00000';
  if (price < 0.00001) return price.toExponential(2);
  return price.toFixed(decimals);
}

export function formatAmount(amount: bigint, decimals: number = 4): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  
  if (fraction === BigInt(0)) {
    return whole.toString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, '0');
  return `${whole}.${fractionStr}`;
}