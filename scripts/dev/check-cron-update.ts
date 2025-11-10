#!/usr/bin/env tsx
/**
 * Check if database was updated in last N minutes
 * Usage: tsx scripts/dev/check-cron-update.ts [minutes=2]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MINUTES_AGO = parseInt(process.argv[2] || '2', 10);

async function main() {
  console.log(`🔍 Checking database updates from last ${MINUTES_AGO} minutes...\n`);

  // 1. Check SyncCheckpoint updates
  const checkpoints = await prisma.$queryRaw<Array<{
    key: string;
    lastBlock: bigint;
    updatedAt: Date;
  }>>`
    SELECT key, "lastBlock", "updatedAt"
    FROM "SyncCheckpoint"
    WHERE key LIKE 'NPM:%'
    ORDER BY "updatedAt" DESC
    LIMIT 5;
  `;

  console.log('📊 SyncCheckpoint Updates:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (checkpoints.length === 0) {
    console.log('❌ No checkpoints found');
  } else {
    for (const cp of checkpoints) {
      const ageMs = Date.now() - cp.updatedAt.getTime();
      const ageMinutes = Math.floor(ageMs / 60000);
      const ageSeconds = Math.floor((ageMs % 60000) / 1000);
      const isRecent = ageMs < MINUTES_AGO * 60 * 1000;
      
      console.log(`${isRecent ? '✅' : '❌'} ${cp.key}`);
      console.log(`   Last Block: ${cp.lastBlock}`);
      console.log(`   Updated: ${ageMinutes}m ${ageSeconds}s ago (${cp.updatedAt.toISOString()})`);
      console.log('');
    }
  }

  // 2. Check PositionTransfer entries
  const twoMinutesAgo = Math.floor(Date.now() / 1000) - (MINUTES_AGO * 60);
  
  const transfers = await prisma.$queryRaw<Array<{
    count: bigint;
    max_block: bigint;
    max_timestamp: bigint;
  }>>`
    SELECT 
      COUNT(*) as count,
      MAX("blockNumber") as max_block,
      MAX("timestamp") as max_timestamp
    FROM "PositionTransfer"
    WHERE "timestamp" > ${twoMinutesAgo};
  `;

  console.log('📊 PositionTransfer Entries (last 2 min):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const transferCount = Number(transfers[0]?.count || 0);
  const hasRecentTransfers = transferCount > 0;
  
  if (hasRecentTransfers) {
    console.log(`✅ ${transferCount} new entries`);
    console.log(`   Latest Block: ${transfers[0]?.max_block}`);
    console.log(`   Latest Timestamp: ${transfers[0]?.max_timestamp ? new Date(Number(transfers[0].max_timestamp) * 1000).toISOString() : 'N/A'}`);
  } else {
    console.log('❌ No new PositionTransfer entries');
  }
  console.log('');

  // 3. Summary
  const latestCheckpoint = checkpoints[0];
  const isRecentUpdate = latestCheckpoint && 
    (Date.now() - latestCheckpoint.updatedAt.getTime()) < MINUTES_AGO * 60 * 1000;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 SUMMARY:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (isRecentUpdate || hasRecentTransfers) {
    console.log('✅ DATABASE WAS UPDATED');
    console.log(`   Checkpoint: ${latestCheckpoint?.key || 'N/A'}`);
    console.log(`   New Transfers: ${transferCount}`);
  } else {
    console.log('❌ NO RECENT UPDATES');
    console.log(`   Last checkpoint: ${latestCheckpoint?.updatedAt.toISOString() || 'Never'}`);
    console.log(`   Age: ${latestCheckpoint ? Math.floor((Date.now() - latestCheckpoint.updatedAt.getTime()) / 60000) : 'N/A'} minutes`);
  }
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());



