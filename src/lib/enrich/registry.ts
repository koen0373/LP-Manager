import { promises as fs } from 'fs';
import path from 'path';

export type EnrichComponent =
  | 'mv_pool_latest_state'
  | 'mv_pool_fees_24h'
  | 'mv_position_latest_event'
  | 'mv_position_range_status'
  | 'mv_pool_position_stats'
  | 'api_enrich_price'
  | 'api_enrich_range_status'
  | 'api_enrich_refresh_views';

const VIEW_PATHS: Record<
  Extract<EnrichComponent, `mv_${string}`>,
  string[]
> = {
  mv_pool_latest_state: ['db/views/mv_pool_latest_state.sql'],
  mv_pool_fees_24h: ['db/views/mv_pool_fees_24h.sql'],
  mv_position_latest_event: ['db/views/mv_position_latest_event.sql'],
  mv_position_range_status: ['db/views/mv_position_range_status.sql'],
  mv_pool_position_stats: ['db/views/mv_pool_position_stats.sql'],
};

const API_PATHS: Record<
  Extract<EnrichComponent, `api_${string}`>,
  string[]
> = {
  api_enrich_price: [
    'app/api/enrich/price/route.ts',
    'pages/api/enrich/price.ts',
  ],
  api_enrich_range_status: [
    'app/api/enrich/range-status/route.ts',
    'pages/api/enrich/range-status.ts',
  ],
  api_enrich_refresh_views: [
    'app/api/enrich/refresh-views/route.ts',
    'pages/api/enrich/refresh-views.ts',
  ],
};

async function pathExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(path.join(process.cwd(), relativePath));
    return true;
  } catch {
    return false;
  }
}

async function anyExists(paths: string[]): Promise<boolean> {
  for (const relPath of paths) {
    if (await pathExists(relPath)) {
      return true;
    }
  }
  return false;
}

export async function detect(): Promise<Record<EnrichComponent, boolean>> {
  const entries: [EnrichComponent, boolean][] = [];

  for (const [component, files] of Object.entries(VIEW_PATHS) as Array<
    [Extract<EnrichComponent, `mv_${string}`>, string[]]
  >) {
    entries.push([component, await anyExists(files)]);
  }

  for (const [component, files] of Object.entries(API_PATHS) as Array<
    [Extract<EnrichComponent, `api_${string}`>, string[]]
  >) {
    entries.push([component, await anyExists(files)]);
  }

  return Object.fromEntries(entries) as Record<EnrichComponent, boolean>;
}

export async function summary(): Promise<{
  ok: boolean;
  components: Record<EnrichComponent, boolean>;
  missing: EnrichComponent[];
}> {
  const components = await detect();
  const missing = Object.entries(components)
    .filter(([, present]) => !present)
    .map(([key]) => key as EnrichComponent);

  return {
    ok: missing.length === 0,
    components,
    missing,
  };
}
