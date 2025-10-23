#!/usr/bin/env tsx

import { getWalletPositions } from '../src/services/flarescanService';
import { db } from '../src/store/prisma';
import { getCapitalFlowStats } from '../src/lib/data/capitalFlows';

async function main() {
  const address = '0x57d294D815968F0EFA722f1E8094da65402cd951';
  
  console.log(`\n🔍 Testing Wallet Summary for ${address}\n`);

  // Step 1: Get live positions
  console.log('📊 Fetching live positions...');
  const livePositions = await getWalletPositions(address, { refresh: false });
  console.log(`   Found ${livePositions.length} positions`);
  
  const totalTvlUsd = livePositions.reduce((sum, pos) => sum + pos.tvlUsd, 0);
  const totalRewardsUsd = livePositions.reduce((sum, pos) => sum + pos.rewardsUsd, 0);
  console.log(`   Total TVL: $${totalTvlUsd.toFixed(2)}`);
  console.log(`   Total Rewards: $${totalRewardsUsd.toFixed(2)}`);

  // Step 2: Get position transfers
  console.log('\n📦 Fetching position transfers...');
  const transfers = await db.positionTransfer.findMany({
    where: {
      OR: [
        { from: address },
        { to: address },
      ],
    },
  });
  console.log(`   Found ${transfers.length} transfers`);

  // Step 3: Get capital flows
  console.log('\n💰 Fetching capital flows...');
  const capitalStats = await getCapitalFlowStats(address);
  console.log(`   Total Flows: ${capitalStats.totalFlows}`);
  console.log(`   Deposits: $${capitalStats.totalDepositsUsd.toFixed(2)}`);
  console.log(`   Withdrawals: $${capitalStats.totalWithdrawalsUsd.toFixed(2)}`);
  console.log(`   Fees Realized: $${capitalStats.totalFeesRealizedUsd.toFixed(2)}`);

  // Step 4: Get position events
  console.log('\n📝 Fetching position events...');
  const events = await db.positionEvent.findMany({
    where: {
      owner: address,
    },
  });
  console.log(`   Found ${events.length} events`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Wallet Summary');
  console.log('='.repeat(60));
  console.log(`Wallet:           ${address}`);
  console.log(`Live Positions:   ${livePositions.length}`);
  console.log(`Total TVL:        $${totalTvlUsd.toFixed(2)}`);
  console.log(`Total Rewards:    $${totalRewardsUsd.toFixed(2)}`);
  console.log(`Transfers:        ${transfers.length}`);
  console.log(`Events:           ${events.length}`);
  console.log(`Capital Flows:    ${capitalStats.totalFlows}`);
  console.log('='.repeat(60));

  console.log('\n✅ Test complete!\n');
}

main()
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  })
  .finally(() => {
    db.$disconnect();
  });
