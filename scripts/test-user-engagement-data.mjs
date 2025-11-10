#!/usr/bin/env node
/**
 * Test User Engagement Report Data Availability
 * 
 * Tests SQL queries from WEEKLY_REPORT_USER_ENGAGEMENT_SPEC.md
 * against actual database to see what data is available
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Test wallet address (use a known address from database)
const TEST_WALLET = '0xf406b4e97c31420D91fBa42a3a9D8cfe47BF710b'; // Top wallet from report

// Helper to serialize BigInt for JSON
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

async function testQuery(name, queryFn) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🧪 TEST: ${name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  try {
    const result = await queryFn();
    console.log(`✅ SUCCESS`);
    const serialized = serializeBigInt(result);
    console.log(`📊 Result:`, JSON.stringify(serialized, null, 2));
    return { success: true, data: serialized };
  } catch (error) {
    console.log(`❌ FAILED`);
    console.log(`Error:`, error.message);
    if (error.stack) {
      console.log(`Stack:`, error.stack.split('\n').slice(0, 3).join('\n'));
    }
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Testing User Engagement Report Data Availability');
  console.log(`📋 Test Wallet: ${TEST_WALLET}`);
  console.log(`📅 Date: ${new Date().toISOString()}\n`);

  const results = {};

  // Test 1: Check if we can get user positions
  results.test1 = await testQuery('Get User Positions', async () => {
    const positions = await prisma.$queryRaw`
      SELECT 
        pt."tokenId",
        pt."to" as owner,
        pe."pool",
        p."token0Symbol",
        p."token1Symbol",
        COUNT(*) as event_count
      FROM "PositionTransfer" pt
      LEFT JOIN "PositionEvent" pe ON pe."tokenId" = pt."tokenId"
      LEFT JOIN "Pool" p ON p.address = pe."pool"
      WHERE LOWER(pt."to") = LOWER(${TEST_WALLET})
        AND pt."to" != '0x0000000000000000000000000000000000000000'
      GROUP BY pt."tokenId", pt."to", pe."pool", p."token0Symbol", p."token1Symbol"
      LIMIT 10;
    `;
    return { count: positions.length, sample: positions[0] || null };
  });

  // Test 2: Check PositionEvent data structure
  results.test2 = await testQuery('PositionEvent Structure', async () => {
    const events = await prisma.$queryRaw`
      SELECT 
        "eventType",
        "amount0",
        "amount1",
        "usdValue",
        "timestamp",
        COUNT(*) as count
      FROM "PositionEvent"
      WHERE "tokenId" IN (
        SELECT DISTINCT "tokenId" 
        FROM "PositionTransfer" 
        WHERE LOWER("to") = LOWER(${TEST_WALLET})
        LIMIT 5
      )
      GROUP BY "eventType", "amount0", "amount1", "usdValue", "timestamp"
      LIMIT 5;
    `;
    return { sample: events[0] || null, total: events.length };
  });

  // Test 3: Check Pool data
  results.test3 = await testQuery('Pool Data Availability', async () => {
    const pools = await prisma.pool.findMany({
      where: {
        address: {
          in: await prisma.$queryRaw`
            SELECT DISTINCT "pool" 
            FROM "PositionEvent" 
            WHERE "pool" IS NOT NULL 
            LIMIT 10
          `.then(r => r.map(x => x.pool))
        }
      },
      select: {
        address: true,
        token0Symbol: true,
        token1Symbol: true,
        token0Decimals: true,
        token1Decimals: true,
        fee: true,
      },
      take: 5,
    });
    return { count: pools.length, sample: pools[0] || null };
  });

  // Test 4: Check PositionTransfer for ownership
  results.test4 = await testQuery('Position Ownership Tracking', async () => {
    const ownership = await prisma.$queryRaw`
      WITH latest_transfers AS (
        SELECT DISTINCT ON ("tokenId")
          "tokenId",
          "to" as owner,
          "timestamp",
          "nfpmAddress"
        FROM "PositionTransfer"
        WHERE "to" != '0x0000000000000000000000000000000000000000'
        ORDER BY "tokenId", "timestamp" DESC
      )
      SELECT 
        COUNT(*) as total_positions,
        COUNT(DISTINCT owner) as unique_owners,
        COUNT(*) FILTER (WHERE LOWER(owner) = LOWER(${TEST_WALLET})) as user_positions
      FROM latest_transfers;
    `;
    return ownership[0];
  });

  // Test 5: Check if we have fees data
  results.test5 = await testQuery('Fees Data Availability', async () => {
    // Check PositionEvent for COLLECT events (fees)
    const fees = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as collect_events,
        COUNT(DISTINCT "tokenId") as positions_with_fees,
        COUNT(DISTINCT "pool") as pools_with_fees
      FROM "PositionEvent"
      WHERE "eventType" = 'COLLECT'
        AND "timestamp" > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days')::bigint;
    `;
    return fees[0];
  });

  // Test 6: Check analytics_position_snapshot (if exists)
  results.test6 = await testQuery('Analytics Position Snapshots', async () => {
    const snapshots = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_snapshots,
        COUNT(DISTINCT "positionIdFk") as unique_positions,
        MIN("ts") as earliest_snapshot,
        MAX("ts") as latest_snapshot,
        COUNT(*) FILTER (WHERE "inRange" = true) as in_range_count,
        COUNT(*) FILTER (WHERE "feesUsd" > 0) as snapshots_with_fees
      FROM "analytics_position_snapshot"
      WHERE "ts" > NOW() - INTERVAL '7 days';
    `;
    return snapshots[0];
  });

  // Test 7: Check PoolIncentive data
  results.test7 = await testQuery('Pool Incentives Data', async () => {
    const incentives = await prisma.poolIncentive.findMany({
      where: { isActive: true },
      select: {
        poolAddress: true,
        rewardTokenSymbol: true,
        rewardUsdPerDay: true,
        startDate: true,
        endDate: true,
      },
      take: 5,
    });
    return { count: incentives.length, sample: incentives[0] || null };
  });

  // Test 8: Check analytics tables
  results.test8 = await testQuery('Analytics Tables Structure', async () => {
    const analytics = await prisma.$queryRaw`
      SELECT 
        (SELECT COUNT(*) FROM "analytics_position") as total_positions,
        (SELECT COUNT(*) FROM "analytics_position_snapshot") as total_snapshots,
        (SELECT COUNT(*) FROM "analytics_wallet") as total_wallets,
        (SELECT COUNT(*) FROM "analytics_market") as total_markets;
    `;
    return analytics[0];
  });

  // Summary
  console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 TEST SUMMARY`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const passed = Object.values(results).filter(r => r.success).length;
  const total = Object.keys(results).length;

  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}\n`);

  console.log(`📋 Detailed Results:\n`);
  Object.entries(results).forEach(([key, result]) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${key}: ${result.success ? 'OK' : result.error}`);
  });

  // Data availability assessment
  console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📈 DATA AVAILABILITY ASSESSMENT`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const assessment = {
    'Position Ownership': results.test4?.success ? '✅ Available' : '❌ Missing',
    'Position Events': results.test2?.success ? '✅ Available' : '❌ Missing',
    'Pool Metadata': results.test3?.success ? '✅ Available' : '❌ Missing',
    'Fees Data': results.test5?.success ? '✅ Available' : '❌ Missing',
    'Position Snapshots': results.test6?.success ? '✅ Available' : '❌ Missing',
    'Incentives': results.test7?.success ? '✅ Available' : '❌ Missing',
    'Analytics Tables': results.test8?.success ? '✅ Available' : '❌ Missing',
  };

  Object.entries(assessment).forEach(([key, value]) => {
    console.log(`${value} ${key}`);
  });

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

