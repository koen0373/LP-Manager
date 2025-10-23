#!/usr/bin/env tsx

/**
 * Indexer Sanity Check
 * 
 * Usage:
 *   npm run indexer:sanity
 *   npm run indexer:sanity 22003
 * 
 * Validates indexed data and prints statistics
 */

import { PrismaClient, PositionEventType } from '@prisma/client';

async function main() {
  const args = process.argv.slice(2);
  const tokenId = args[0];

  const prisma = new PrismaClient();

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              INDEXER SANITY CHECK                             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    if (tokenId) {
      // Check specific tokenId
      console.log(`🔍 Checking tokenId: ${tokenId}`);
      console.log('');

      await checkTokenId(prisma, tokenId);
    } else {
      // Check global stats
      console.log('🌍 Global statistics:');
      console.log('');

      await checkGlobal(prisma);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log('');
  console.log('✅ Sanity check complete');
  console.log('');
}

async function checkTokenId(prisma: PrismaClient, tokenId: string) {
  // Get transfers
  const transfers = await prisma.positionTransfer.findMany({
    where: { tokenId },
    orderBy: { blockNumber: 'asc' },
  });

  // Get events by type
  const increases = await prisma.positionEvent.findMany({
    where: { tokenId, eventType: PositionEventType.INCREASE },
    orderBy: { blockNumber: 'asc' },
  });

  const decreases = await prisma.positionEvent.findMany({
    where: { tokenId, eventType: PositionEventType.DECREASE },
    orderBy: { blockNumber: 'asc' },
  });

  const collects = await prisma.positionEvent.findMany({
    where: { tokenId, eventType: PositionEventType.COLLECT },
    orderBy: { blockNumber: 'asc' },
  });

  console.log(`📊 Event counts:`);
  console.log(`   - Transfers: ${transfers.length}`);
  console.log(`   - IncreaseLiquidity: ${increases.length}`);
  console.log(`   - DecreaseLiquidity: ${decreases.length}`);
  console.log(`   - Collect: ${collects.length}`);
  console.log(`   - Total: ${transfers.length + increases.length + decreases.length + collects.length}`);
  console.log('');

  // Block range
  const allEvents = [...transfers, ...increases, ...decreases, ...collects];
  if (allEvents.length > 0) {
    const minBlock = Math.min(...allEvents.map((e) => e.blockNumber));
    const maxBlock = Math.max(...allEvents.map((e) => e.blockNumber));

    console.log(`📦 Block range:`);
    console.log(`   - First event: block ${minBlock}`);
    console.log(`   - Last event: block ${maxBlock}`);
    console.log(`   - Span: ${maxBlock - minBlock + 1} blocks`);
    console.log('');
  }

  // Current owner (from last transfer)
  if (transfers.length > 0) {
    const lastTransfer = transfers[transfers.length - 1];
    console.log(`👤 Current owner: ${lastTransfer.to}`);
    console.log('');
  }

  // Recent events
  const recentEvents = allEvents.sort((a, b) => b.blockNumber - a.blockNumber).slice(0, 5);
  if (recentEvents.length > 0) {
    console.log(`📝 Recent events:`);
    for (const event of recentEvents) {
      const type = 'from' in event ? 'TRANSFER' : (event as any).eventType;
      console.log(`   - Block ${event.blockNumber}: ${type} (${event.txHash.slice(0, 10)}...)`);
    }
    console.log('');
  }
}

async function checkGlobal(prisma: PrismaClient) {
  // Total counts
  const [transferCount, eventCount] = await Promise.all([
    prisma.positionTransfer.count(),
    prisma.positionEvent.count(),
  ]);

  console.log(`📊 Total events:`);
  console.log(`   - Transfers: ${transferCount.toLocaleString()}`);
  console.log(`   - Position events: ${eventCount.toLocaleString()}`);
  console.log(`   - Total: ${(transferCount + eventCount).toLocaleString()}`);
  console.log('');

  // Events by type
  const eventsByType = await prisma.positionEvent.groupBy({
    by: ['eventType'],
    _count: { eventType: true },
  });

  console.log(`📈 Events by type:`);
  for (const group of eventsByType) {
    console.log(`   - ${group.eventType}: ${group._count.eventType.toLocaleString()}`);
  }
  console.log('');

  // Unique tokenIds
  const uniqueTokenIds = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT "tokenId") as count
    FROM (
      SELECT "tokenId" FROM "PositionTransfer"
      UNION
      SELECT "tokenId" FROM "PositionEvent"
    ) as combined
  `;

  console.log(`🎯 Unique tokenIds: ${Number(uniqueTokenIds[0].count).toLocaleString()}`);
  console.log('');

  // Block range
  const [transferRange, eventRange] = await Promise.all([
    prisma.positionTransfer.aggregate({
      _min: { blockNumber: true },
      _max: { blockNumber: true },
    }),
    prisma.positionEvent.aggregate({
      _min: { blockNumber: true },
      _max: { blockNumber: true },
    }),
  ]);

  const minBlock = Math.min(transferRange._min.blockNumber ?? Infinity, eventRange._min.blockNumber ?? Infinity);
  const maxBlock = Math.max(transferRange._max.blockNumber ?? 0, eventRange._max.blockNumber ?? 0);

  if (minBlock !== Infinity) {
    console.log(`📦 Block range:`);
    console.log(`   - First event: block ${minBlock.toLocaleString()}`);
    console.log(`   - Last event: block ${maxBlock.toLocaleString()}`);
    console.log(`   - Span: ${(maxBlock - minBlock + 1).toLocaleString()} blocks`);
    console.log('');
  }

  // Checkpoints
  const checkpoints = await prisma.syncCheckpoint.findMany({
    where: { source: 'NPM' },
    orderBy: { lastBlock: 'desc' },
  });

  if (checkpoints.length > 0) {
    console.log(`📍 Checkpoints:`);
    for (const cp of checkpoints.slice(0, 5)) {
      console.log(`   - ${cp.key}: block ${cp.lastBlock.toLocaleString()} (${cp.eventsCount.toLocaleString()} events)`);
    }
    if (checkpoints.length > 5) {
      console.log(`   ... and ${checkpoints.length - 5} more`);
    }
    console.log('');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

