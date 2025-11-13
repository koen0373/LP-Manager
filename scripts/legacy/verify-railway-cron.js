#!/usr/bin/env node
/**
 * Verify Railway Indexer Follower Configuration
 * 
 * Checks if the daily follower will scan both Enosys and SparkDEX NFPMs
 */

const { indexerConfig } = require('../indexer.config');

console.log('🔍 Railway Indexer Follower Configuration Check\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Check NFPM configuration
console.log('📍 NFPM Contracts:');
const npmAddresses = Array.isArray(indexerConfig.contracts.npm) 
  ? indexerConfig.contracts.npm 
  : [indexerConfig.contracts.npm];

npmAddresses.forEach((address, index) => {
  const name = address.toLowerCase() === '0xd9770b1c7a6ccd33c75b5bcb1c0078f46be46657' 
    ? 'Enosys V3 NFPM' 
    : address.toLowerCase() === '0xee5ff5bc5f852764b5584d92a4d592a53dc527da'
    ? 'SparkDEX V3 NFPM'
    : 'Unknown';
  console.log(`  ${index + 1}. ${name}`);
  console.log(`     ${address}`);
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Check RPC configuration
console.log('🌐 RPC Configuration:');
console.log(`  URL: ${indexerConfig.rpc.url}`);
console.log(`  RPS: ${indexerConfig.rpc.rps}`);
console.log(`  Concurrency: ${indexerConfig.rpc.concurrency}`);
console.log(`  Block Window: ${indexerConfig.rpc.blockWindow}`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Check follower configuration
console.log('⏰ Follower Configuration:');
console.log(`  Poll Interval: ${indexerConfig.follower.pollIntervalMs / 1000}s`);
console.log(`  Confirmation Blocks: ${indexerConfig.follower.confirmationBlocks}`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Verification
const hasEnosys = npmAddresses.some(addr => 
  addr.toLowerCase() === '0xd9770b1c7a6ccd33c75b5bcb1c0078f46be46657'
);
const hasSparkDEX = npmAddresses.some(addr => 
  addr.toLowerCase() === '0xee5ff5bc5f852764b5584d92a4d592a53dc527da'
);

console.log('✅ Verification Results:');
console.log(`  Enosys NFPM:   ${hasEnosys ? '✅ Configured' : '❌ Missing'}`);
console.log(`  SparkDEX NFPM: ${hasSparkDEX ? '✅ Configured' : '❌ Missing'}`);
console.log(`  Multi-NFPM:    ${npmAddresses.length > 1 ? '✅ Enabled' : '⚠️  Single NFPM only'}`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (hasEnosys && hasSparkDEX && npmAddresses.length === 2) {
  console.log('🎉 SUCCESS: Daily follower will scan BOTH Enosys and SparkDEX NFPMs!\n');
  process.exit(0);
} else if (npmAddresses.length === 1) {
  console.log('⚠️  WARNING: Only ONE NFPM configured. Daily follower will miss data!\n');
  console.log('💡 FIX: Update indexer.config.ts to use array of NFPMs:\n');
  console.log('   contracts: {');
  console.log('     npm: [');
  console.log('       "0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657", // Enosys');
  console.log('       "0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da", // SparkDEX');
  console.log('     ],');
  console.log('   }\n');
  process.exit(1);
} else {
  console.log('❌ ERROR: NFPM configuration is incorrect!\n');
  process.exit(1);
}

