const USD_FORMATTERS: Record<string, Intl.NumberFormat> = {};

function getUsdFormatter(digits: number): Intl.NumberFormat {
  const key = `usd-${digits}`;
  if (!USD_FORMATTERS[key]) {
    USD_FORMATTERS[key] = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }
  return USD_FORMATTERS[key];
}

function determineFractionDigits(value: number): number {
  const abs = Math.abs(value);
  if (abs === 0) return 2;
  if (abs < 1) return 2;
  if (abs < 1000) return 2;
  if (abs < 1_000_000) return 0;
  return 0;
}

export function formatUsd(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  const digits = determineFractionDigits(value);
  return getUsdFormatter(digits).format(value);
}

export function formatDeltaUsd(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  if (value === 0) {
    return '±$0';
  }
  const formatted = formatUsd(Math.abs(value));
  return value > 0 ? `+${formatted}` : `-${formatted}`;
}

export function formatCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return Math.round(value).toLocaleString('en-US');
}

export function formatDeltaCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  if (value === 0) {
    return '±0';
  }
  const formatted = Math.abs(Math.round(value)).toLocaleString('en-US');
  return value > 0 ? `+${formatted}` : `-${formatted}`;
}
