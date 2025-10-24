// Time range utilities for chart filtering

export type TimeRange = '24h' | '7d' | '1m' | '1y';

/**
 * Get millisecond window for a time range
 */
export function getWindowMs(timeRange: TimeRange): number {
  switch (timeRange) {
    case '24h': return 24 * 3600 * 1000;
    case '7d':  return 7 * 24 * 3600 * 1000;
    case '1m':  return 30 * 24 * 3600 * 1000;
    case '1y':  return 365 * 24 * 3600 * 1000;
  }
}

/**
 * Normalize timestamp to milliseconds
 */
export function normalizeTimestamp(t: number | string): number {
  if (typeof t === 'string') {
    // Try ISO string first
    const parsed = Date.parse(t);
    if (!isNaN(parsed)) return parsed;
    // Fallback to unix seconds
    const num = parseInt(t, 10);
    return num < 10_000_000_000 ? num * 1000 : num;
  }
  // Number: assume unix seconds if < 10 billion
  return t < 10_000_000_000 ? t * 1000 : t;
}

/**
 * Format X-axis based on time range
 */
export function getXAxisFormatter(timeRange: TimeRange) {
  return (value: number) => {
    const d = new Date(value);
    switch (timeRange) {
      case '24h':
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case '7d':
      case '1m':
        return d.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
      case '1y':
        return d.toLocaleDateString([], { month: 'short' });
    }
  };
}

