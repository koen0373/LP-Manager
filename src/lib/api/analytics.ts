export type AnalyticsSummaryData = {
  tvlTotal: number;
  poolsActive: number;
  positionsActive: number;
  fees24h: number;
  fees7d: number;
};

export type AnalyticsSummaryResponse = {
  ok?: boolean;
  degrade?: boolean;
  ts: number;
  data?: AnalyticsSummaryData;
};

export type AnalyticsPoolData = {
  state: string;
  tvl: number;
  fees24h: number;
  fees7d: number;
  positionsCount: number;
};

export type AnalyticsPoolResponse = {
  ok?: boolean;
  degrade?: boolean;
  ts: number;
  pool?: AnalyticsPoolData;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }

  return response.json();
}

export async function fetchSummary(): Promise<AnalyticsSummaryResponse> {
  try {
    return await fetchJson<AnalyticsSummaryResponse>('/api/analytics/summary');
  } catch {
    return {
      ok: false,
      degrade: true,
      ts: Date.now(),
      data: undefined,
    };
  }
}

export async function fetchPool(address: string): Promise<AnalyticsPoolResponse> {
  try {
    return await fetchJson<AnalyticsPoolResponse>(`/api/analytics/pool/${encodeURIComponent(address)}`);
  } catch {
    return {
      ok: false,
      degrade: true,
      ts: Date.now(),
      pool: undefined,
    };
  }
}
