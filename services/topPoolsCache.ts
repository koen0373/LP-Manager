export type TopPool = {
  id: string;
  name: string;
  tvlUsd?: number;
  volume24hUsd?: number;
  feeApr?: number;
};

let _items: TopPool[] = [
  { id: 'stub-1', name: 'WFLR/USDC.e', tvlUsd: 120000, volume24hUsd: 6000, feeApr: 12.5 },
  { id: 'stub-2', name: 'FXRP/WFLR',   tvlUsd:  95000, volume24hUsd: 4200, feeApr: 10.1 },
  { id: 'stub-3', name: 'sFLR/WFLR',   tvlUsd:  73000, volume24hUsd: 1800, feeApr:  7.4 },
];

let _updatedAt = new Date().toISOString();

export async function getTopPools(limit: number = 10): Promise<TopPool[]> {
  return _items.slice(0, limit);
}

export async function refreshTopPools(): Promise<void> {
  // no-op in stub; pretend we refreshed
  _updatedAt = new Date().toISOString();
}

export function clearCache(): void {
  _items = [];
  _updatedAt = new Date().toISOString();
}

/** --- Named exports expected by /pages/api/pools/top.ts --- */
export async function readTopPoolsCache(): Promise<{ items: TopPool[]; updatedAt: string }> {
  return { items: _items, updatedAt: _updatedAt };
}

export function selectDiversePools(pools: TopPool[], limit: number = 10): TopPool[] {
  // trivial diversity heuristic for stub: interleave by name hash
  const sorted = [...pools].sort((a, b) => a.name.localeCompare(b.name));
  const alt = [...pools].sort((a, b) => (a.tvlUsd || 0) < (b.tvlUsd || 0) ? 1 : -1);
  const mix: TopPool[] = [];
  for (let i = 0; i < Math.max(sorted.length, alt.length); i++) {
    if (sorted[i]) mix.push(sorted[i]);
    if (alt[i]) mix.push(alt[i]);
    if (mix.length >= limit) break;
  }
  // stable dedup by id
  const seen = new Set<string>();
  return mix.filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true))).slice(0, limit);
}

export function getCacheAge(updatedAtIso?: string): number {
  const ts = updatedAtIso ? Date.parse(updatedAtIso) : Date.parse(_updatedAt);
  const ageMs = Date.now() - ts;
  return Math.max(0, Math.floor(ageMs / 1000)); // seconds
}
