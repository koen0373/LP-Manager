import type { PositionRow, PositionsResponse } from './types';

const API_BASE = '/api/positions';

function ensureNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Fetch positions for a wallet from the canonical `/api/positions` endpoint.
 *
 * The helper centralises error parsing so callers can rely on thrown `Error`
 * instances with friendly messages when the request fails.
 */
export async function fetchPositions(
  address: string,
  opts: { signal?: AbortSignal } = {},
): Promise<PositionsResponse> {
  const url = `${API_BASE}?address=${encodeURIComponent(address)}`;
  const response = await fetch(url, {
    cache: 'no-store',
    signal: opts.signal,
  });

  const handleError = async () => {
    let message = `Failed to fetch positions (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) {
        message = payload.error;
      }
    } catch (error) {
      console.warn('[fetchPositions] Unable to parse error payload', error);
    }
    throw new Error(message);
  };

  if (!response.ok) {
    await handleError();
  }

  const payload = (await response.json()) as PositionsResponse;
  if (!payload?.success || !payload.data) {
    const message = payload?.error ?? 'Positions payload missing data';
    throw new Error(message);
  }

  return payload;
}

/**
 * Compute aggregate totals for a collection of positions. Mirrors the summary
 * block returned by the API so client-side code can safely recompute when it
 * needs to derive custom views.
 */
export function computeSummary(rows: PositionRow[]) {
  return rows.reduce(
    (acc, row) => {
      const tvl = ensureNumber(row.tvlUsd);
      const fees = ensureNumber(row.unclaimedFeesUsd);
      const incentives = ensureNumber(row.incentivesUsd);
      const rewards = ensureNumber(row.rewardsUsd || fees + incentives);

      acc.tvlUsd += tvl;
      acc.fees24hUsd += fees;
      acc.incentivesUsd += incentives;
      acc.rewardsUsd += rewards;
      acc.count += 1;

      switch (row.category) {
        case 'Active':
          acc.active += 1;
          break;
        case 'Inactive':
          acc.inactive += 1;
          break;
        case 'Ended':
          acc.ended += 1;
          break;
        default:
          break;
      }

      return acc;
    },
    {
      tvlUsd: 0,
      fees24hUsd: 0,
      incentivesUsd: 0,
      rewardsUsd: 0,
      count: 0,
      active: 0,
      inactive: 0,
      ended: 0,
    },
  );
}

