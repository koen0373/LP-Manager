"use strict";
// TODO: Make these helpers i18n/locale aware in the future
// Currently using en-US formatting hardcoded
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatUsd = formatUsd;
exports.formatPercent = formatPercent;
exports.formatCompact = formatCompact;
exports.formatNumber = formatNumber;
/**
 * Format a number as USD currency
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted USD string (e.g., "$1,234.56")
 */
function formatUsd(value, decimals = 2) {
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
function formatPercent(value, decimals = 2) {
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
function formatCompact(value, decimals = 1) {
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
function formatNumber(value, decimals = 0) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}
