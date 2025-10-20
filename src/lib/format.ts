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