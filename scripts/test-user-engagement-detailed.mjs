#!/usr/bin/env node
/**
 * Detailed User Engagement Data Availability Test
 * 
 * Tests specific queries from WEEKLY_REPORT_USER_ENGAGEMENT_SPEC.md
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const TEST_WALLET = '0xf406b4e97c31420D91fBa42a3a9D8cfe47BF710b';

function serializeBigInt(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  return obj;
}

async function testSpecQuery(name, queryFn) {
  console.log(`\n📋 ${name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  try {
    const result = await queryFn();
    const serialized = serializeBigInt(result);
    
    if (Array.isArray(serialized)) {
      console.log(`✅ Found ${serialized.length} rows`);
      if (serialized.length > 0) {
        console.log(`📊 Sample:`, JSON.stringify(serialized[0], null, 2));
      }
    } else {
      console.log(`✅ Result:`, JSON.stringify(serialized, null, 2));
    }
    
    return { success: true, data: serialized };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔍 Testing User Engagement Report Data Availability');
  console.log(`📋 Test Wallet: ${TEST_WALLET}\n`);

  const results = {};

  // Test A.1: Week Performance Overview
  results.weekPerformance = await testSpecQuery('A.1 Week Performance Overview', async () => {
    return await prisma.$queryRaw`
      WITH user_positions AS (
        SELECT DISTINCT pt."tokenId"
        FROM "PositionTransfer" pt
        WHERE LOWER(pt."to") = LOWER(${TEST_WALLET})
          AND pt."to" != '0x0000000000000000000000000000000000000000'
      )
      SELECT 
        COUNT(DISTINCT up."tokenId") as active_positions,
        COUNT(DISTINCT pe."pool") as active_pools,
        COUNT(*) FILTER (WHERE pe."eventType" = 'COLLECT') as collect_events_week,
        COUNT(*) FILTER (WHERE pe."eventType" = 'INCREASE') as increase_events_week,
        COUNT(*) FILTER (WHERE pe."eventType" = 'DECREASE') as decrease_events_week
      FROM user_positions up
      LEFT JOIN "PositionEvent" pe ON pe."tokenId" = up."tokenId"
        AND pe."timestamp" > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days')::bigint;
    `;
  });

  // Test A.2: P&L Breakdown per Pool
  results.plPerPool = await testSpecQuery('A.2 P&L Breakdown per Pool', async () => {
    return await prisma.$queryRaw`
      WITH user_positions AS (
        SELECT DISTINCT pt."tokenId"
        FROM "PositionTransfer" pt
        WHERE LOWER(pt."to") = LOWER(${TEST_WALLET})
          AND pt."to" != '0x0000000000000000000000000000000000000000'
      )
      SELECT 
        pe."pool",
        p."token0Symbol" || '/' || p."token1Symbol" as pair,
        COUNT(*) FILTER (WHERE pe."eventType" = 'COLLECT') as collect_count,
        COUNT(*) FILTER (WHERE pe."eventType" = 'INCREASE') as increase_count,
        COUNT(*) FILTER (WHERE pe."eventType" = 'DECREASE') as decrease_count,
        COUNT(DISTINCT pe."tokenId") as positions_in_pool
      FROM user_positions up
      JOIN "PositionEvent" pe ON pe."tokenId" = up."tokenId"
      LEFT JOIN "Pool" p ON p.address = pe."pool"
      WHERE pe."pool" IS NOT NULL AND pe."pool" != 'unknown'
      GROUP BY pe."pool", p."token0Symbol", p."token1Symbol"
      ORDER BY positions_in_pool DESC
      LIMIT 10;
    `;
  });

  // Test A.3: Unclaimed Rewards (simplified - check COLLECT events)
  results.unclaimedRewards = await testSpecQuery('A.3 Unclaimed Rewards Check', async () => {
    return await prisma.$queryRaw`
      WITH user_positions AS (
        SELECT DISTINCT pt."tokenId"
        FROM "PositionTransfer" pt
        WHERE LOWER(pt."to") = LOWER(${TEST_WALLET})
          AND pt."to" != '0x0000000000000000000000000000000000000000'
      )
      SELECT 
        COUNT(DISTINCT pe."tokenId") as positions_with_collects,
        COUNT(*) FILTER (WHERE pe."eventType" = 'COLLECT') as total_collect_events,
        MIN(pe."timestamp") as earliest_collect,
        MAX(pe."timestamp") as latest_collect
      FROM user_positions up
      JOIN "PositionEvent" pe ON pe."tokenId" = up."tokenId"
      WHERE pe."eventType" = 'COLLECT'
        AND pe."timestamp" > EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days')::bigint;
    `;
  });

  // Test B.4: Range Status & Efficiency
  results.rangeStatus = await testSpecQuery('B.4 Range Status (PositionEvent only)', async () => {
    return await prisma.$queryRaw`
      WITH user_positions AS (
        SELECT DISTINCT pt."tokenId", pt."nfpmAddress"
        FROM "PositionTransfer" pt
        WHERE LOWER(pt."to") = LOWER(${TEST_WALLET})
          AND pt."to" != '0x0000000000000000000000000000000000000000'
        ORDER BY pt."timestamp" DESC
        LIMIT 10
      )
      SELECT 
        up."tokenId",
        pe."pool",
        pe."tickLower",
        pe."tickUpper",
        pe."tick",
        pe."eventType",
        pe."timestamp",
        CASE 
          WHEN pe."tick" IS NOT NULL AND pe."tickLower" IS NOT NULL AND pe."tickUpper" IS NOT NULL
            AND pe."tick" >= pe."tickLower" AND pe."tick" <= pe."tickUpper
          THEN 'IN_RANGE'
          WHEN pe."tick" IS NOT NULL AND pe."tickLower" IS NOT NULL AND pe."tickUpper" IS NOT NULL
          THEN 'OUT_OF_RANGE'
          ELSE 'UNKNOWN'
        END as range_status
      FROM user_positions up
      LEFT JOIN LATERAL (
        SELECT * FROM "PositionEvent" pe2
        WHERE pe2."tokenId" = up."tokenId"
        ORDER BY pe2."timestamp" DESC
        LIMIT 1
      ) pe ON true
      LIMIT 5;
    `;
  });

  // Test C.6: User Ranking per Pool
  results.userRanking = await testSpecQuery('C.6 User Ranking per Pool', async () => {
    return await prisma.$queryRaw`
      WITH pool_fees AS (
        SELECT 
          pe."pool",
          pt."to" as owner,
          COUNT(*) FILTER (WHERE pe."eventType" = 'COLLECT') as collect_count
        FROM "PositionEvent" pe
        JOIN "PositionTransfer" pt ON pt."tokenId" = pe."tokenId"
        WHERE pe."eventType" = 'COLLECT'
          AND pe."timestamp" > EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days')::bigint
          AND pt."to" != '0x0000000000000000000000000000000000000000'
        GROUP BY pe."pool", pt."to"
      ),
      user_pool_fees AS (
        SELECT * FROM pool_fees WHERE LOWER(owner) = LOWER(${TEST_WALLET})
      )
      SELECT 
        upf."pool",
        upf.collect_count as user_collects,
        (SELECT AVG(collect_count) FROM pool_fees WHERE pool = upf."pool") as pool_avg_collects,
        (SELECT COUNT(*) FROM pool_fees WHERE pool = upf."pool") as total_lps_in_pool
      FROM user_pool_fees upf
      LIMIT 5;
    `;
  });

  // Test D.8: Week-over-Week Growth
  results.weekOverWeek = await testSpecQuery('D.8 Week-over-Week Growth', async () => {
    return await prisma.$queryRaw`
      WITH user_positions AS (
        SELECT DISTINCT pt."tokenId"
        FROM "PositionTransfer" pt
        WHERE LOWER(pt."to") = LOWER(${TEST_WALLET})
          AND pt."to" != '0x0000000000000000000000000000000000000000'
      ),
      this_week AS (
        SELECT COUNT(*) FILTER (WHERE pe."eventType" = 'COLLECT') as collects
        FROM user_positions up
        JOIN "PositionEvent" pe ON pe."tokenId" = up."tokenId"
        WHERE pe."timestamp" > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days')::bigint
      ),
      last_week AS (
        SELECT COUNT(*) FILTER (WHERE pe."eventType" = 'COLLECT') as collects
        FROM user_positions up
        JOIN "PositionEvent" pe ON pe."tokenId" = up."tokenId"
        WHERE pe."timestamp" > EXTRACT(EPOCH FROM NOW() - INTERVAL '14 days')::bigint
          AND pe."timestamp" <= EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days')::bigint
      )
      SELECT 
        tw.collects as collects_this_week,
        lw.collects as collects_last_week,
        CASE 
          WHEN lw.collects > 0 THEN ((tw.collects::numeric - lw.collects::numeric) / lw.collects::numeric * 100)::text
          ELSE 'N/A'
        END as growth_pct
      FROM this_week tw, last_week lw;
    `;
  });

  // Test E.10: Trending Pools
  results.trendingPools = await testSpecQuery('E.10 Trending Pools', async () => {
    return await prisma.$queryRaw`
      SELECT 
        p.address as pool,
        p."token0Symbol" || '/' || p."token1Symbol" as pair,
        p.factory,
        COUNT(DISTINCT pe."tokenId") as total_positions,
        COUNT(*) FILTER (WHERE pe."timestamp" > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days')::bigint) as events_last_week
      FROM "Pool" p
      LEFT JOIN "PositionEvent" pe ON pe."pool" = p.address
      GROUP BY p.address, p."token0Symbol", p."token1Symbol", p.factory
      HAVING COUNT(*) FILTER (WHERE pe."timestamp" > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days')::bigint) > 0
      ORDER BY events_last_week DESC
      LIMIT 10;
    `;
  });

  // Summary
  console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 DATA AVAILABILITY SUMMARY`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const assessment = {
    'Week Performance': results.weekPerformance?.success ? '✅ Available' : '❌ Missing',
    'P&L per Pool': results.plPerPool?.success ? '✅ Available' : '❌ Missing',
    'Unclaimed Rewards': results.unclaimedRewards?.success ? '✅ Available' : '❌ Missing',
    'Range Status': results.rangeStatus?.success ? '✅ Available' : '❌ Missing',
    'User Ranking': results.userRanking?.success ? '✅ Available' : '❌ Missing',
    'Week-over-Week Growth': results.weekOverWeek?.success ? '✅ Available' : '❌ Missing',
    'Trending Pools': results.trendingPools?.success ? '✅ Available' : '❌ Missing',
  };

  Object.entries(assessment).forEach(([key, value]) => {
    console.log(`${value} ${key}`);
  });

  console.log(`\n\n📝 MISSING DATA ANALYSIS:\n`);
  
  if (!results.weekPerformance?.data?.[0]?.active_positions) {
    console.log(`⚠️  Week Performance: Position count available but detailed metrics need calculation`);
  }
  
  if (results.plPerPool?.data?.length === 0) {
    console.log(`⚠️  P&L per Pool: Pool data exists but many positions have pool='unknown'`);
  }
  
  if (results.unclaimedRewards?.data?.[0]?.positions_with_collects === '0') {
    console.log(`⚠️  Unclaimed Rewards: No COLLECT events found (may need different calculation)`);
  }
  
  if (results.rangeStatus?.data?.length === 0) {
    console.log(`⚠️  Range Status: Tick data available but needs aggregation logic`);
  }

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });

