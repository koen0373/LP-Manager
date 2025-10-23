#!/usr/bin/env tsx

import { db } from '../src/store/prisma';

async function main() {
  console.log('🔍 Checking ledger database...\n');

  const [
    positionEventsCount,
    positionTransfersCount,
    capitalFlowsCount,
  ] = await Promise.all([
    db.positionEvent.count(),
    db.positionTransfer.count(),
    db.capitalFlow.count(),
  ]);

  console.log('📊 Ledger Statistics:');
  console.log('='.repeat(60));
  console.log(`Position Events:    ${positionEventsCount}`);
  console.log(`Position Transfers: ${positionTransfersCount}`);
  console.log(`Capital Flows:      ${capitalFlowsCount}`);
  console.log('='.repeat(60));

  // Show sample transfers
  if (positionTransfersCount > 0) {
    console.log('\n📋 Sample Position Transfers:');
    const transfers = await db.positionTransfer.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' },
    });
    
    for (const transfer of transfers) {
      console.log(`\n  Token ID: ${transfer.tokenId}`);
      console.log(`  From:     ${transfer.from}`);
      console.log(`  To:       ${transfer.to}`);
      console.log(`  Block:    ${transfer.blockNumber}`);
      console.log(`  TxHash:   ${transfer.txHash}`);
    }
  }

  // Show sample events
  if (positionEventsCount > 0) {
    console.log('\n📋 Sample Position Events:');
    const events = await db.positionEvent.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' },
    });
    
    for (const event of events) {
      console.log(`\n  Token ID:   ${event.tokenId}`);
      console.log(`  Type:       ${event.eventType}`);
      console.log(`  Pool:       ${event.pool}`);
      console.log(`  Block:      ${event.blockNumber}`);
      console.log(`  TxHash:     ${event.txHash}`);
    }
  }

  console.log('\n✅ Check complete!\n');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(() => {
    db.$disconnect();
  });
