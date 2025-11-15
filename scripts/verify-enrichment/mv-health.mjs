#!/usr/bin/env node

/**
 * Materialized View Health Checker
 * 
 * Checks MV existence, row counts, and refresh status.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CORE_MVS = [
  'mv_pool_latest_state',
  'mv_pool_fees_24h',
  'mv_position_range_status',
  'mv_pool_position_stats',
  'mv_position_latest_event',
];

const EXTENDED_MVS = [
  'mv_pool_volume_7d',
  'mv_pool_fees_7d',
  'mv_positions_active_7d',
  'mv_wallet_lp_7d',
  'mv_pool_changes_7d',
];

async function checkMV(name) {
  try {
    const exists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM pg_matviews WHERE matviewname = ${name}
      ) as exists
    `;
    if (!exists[0]?.exists) {
      return { name, exists: false, rowCount: 0, lastRefresh: null };
    }

    const rowCount = await prisma.$queryRaw`
      SELECT COUNT(*)::bigint as count FROM ${prisma.$queryRawUnsafe(`"${name}"`)}
    `.catch(() => [{ count: BigInt(0) }]);

    // Try to get last refresh time (if available)
    const lastRefresh = await prisma.$queryRaw`
      SELECT pg_stat_get_last_autoanalyze_time(oid) as last_refresh
      FROM pg_class WHERE relname = ${name}
    `.catch(() => [{ last_refresh: null }]);

    return {
      name,
      exists: true,
      rowCount: Number(rowCount[0]?.count || 0),
      lastRefresh: lastRefresh[0]?.last_refresh || 'unknown',
    };
  } catch (error) {
    return {
      name,
      exists: false,
      rowCount: 0,
      lastRefresh: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const allMVs = [...CORE_MVS, ...EXTENDED_MVS];
  const results = [];

  for (const mv of allMVs) {
    const result = await checkMV(mv);
    results.push(result);
  }

  const coreResults = results.filter((r) => CORE_MVS.includes(r.name));
  const extendedResults = results.filter((r) => EXTENDED_MVS.includes(r.name));

  const coreOk = coreResults.every((r) => r.exists && r.rowCount > 0);
  const extendedOk = extendedResults.every((r) => r.exists);

  const output = {
    ok: coreOk && extendedOk,
    core: coreResults,
    extended: extendedResults,
    summary: {
      coreExists: coreResults.filter((r) => r.exists).length,
      coreTotal: coreResults.length,
      extendedExists: extendedResults.filter((r) => r.exists).length,
      extendedTotal: extendedResults.length,
      coreOk,
      extendedOk,
    },
  };

  console.log(JSON.stringify(output, null, 2));

  await prisma.$disconnect();
  process.exit(output.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message ?? String(error) }));
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});

