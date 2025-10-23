// TODO: Make these helpers i18n/locale aware in the future
// Currently using en-US formatting hardcoded

/**
 * Format a number as USD currency
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted USD string (e.g., "$1,234.56")
 */
export function formatUsd(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a number as a percentage
 * @param value - The number to format (e.g., 12.5 for 12.5%)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string (e.g., "12.50%")
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/**
 * Format a number in compact notation
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted compact string (e.g., "1.2K", "3.4M")
 */
export function formatCompact(value: number, decimals: number = 1): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a regular number with thousand separators
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string (e.g., "1,234.56")
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

