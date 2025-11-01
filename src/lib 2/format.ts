export const fmtUsd = (v?: number) =>
  typeof v === 'number'
    ? `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : '—';

export const fmtAmt = (v?: number, max = 2) =>
  typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: max }) : '—';
