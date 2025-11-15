#!/usr/bin/env node

const VIEWS = [
  'mv_pool_latest_state',
  'mv_pool_fees_24h',
  'mv_position_range_status',
  'mv_pool_position_stats',
  'mv_position_latest_event',
  'mv_pool_volume_7d',
  'mv_pool_fees_7d',
  'mv_positions_active_7d',
  'mv_wallet_lp_7d',
  'mv_pool_changes_7d',
];

const { DATABASE_URL, DB_DISABLE } = process.env;

if (DB_DISABLE === 'true' || !DATABASE_URL) {
  console.log('[refresh-views] [SKIP] Database disabled or DATABASE_URL missing');
  process.exit(0);
}

async function connect() {
  try {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    return client;
  } catch (error) {
    console.log('[refresh-views] [SKIP] Unable to connect:', error instanceof Error ? error.message : error);
    process.exit(0);
  }
}

async function refreshViews() {
  const client = await connect();

  for (const viewName of VIEWS) {
    const label = `[refresh-views] ${viewName}`;
    try {
      console.log(`${label} → refresh`);
      await client.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY "${viewName}"`);
      console.log(`${label} ✓`);
    } catch (error) {
      console.log(`${label} ⚠`, error instanceof Error ? error.message : error);
    }
  }

  await client.end().catch(() => {});
  console.log('[refresh-views] Done');
}

refreshViews().catch((error) => {
  console.log('[refresh-views] [SKIP] Unexpected error:', error instanceof Error ? error.message : error);
  process.exit(0);
});

