#!/usr/bin/env tsx
/**
 * Phase 1 Integration Test
 * Tests RPC client, on-chain readers, and FlareScan adapter
 */

import { readLatestBlockNumber, readPositionData, readTokenMetadata } from '../src/lib/onchain/index.js';
import { getContractCreation, getNFTInstanceTransfers } from '../src/lib/adapters/flarescan/index.js';
import { ENOSYS_ADDRESSES, TOKEN_ADDRESSES } from '../src/lib/onchain/config.js';

async function testRpcClient() {
  console.log('\n🔹 Testing RPC Client...');
  
  try {
    const blockNumber = await readLatestBlockNumber();
    if (!blockNumber) throw new Error('Failed to get latest block number');
    console.log(`✅ Latest block: ${blockNumber}`);
  } catch (error) {
    console.error('❌ RPC Client test failed:', error);
    throw error;
  }
}

async function testOnchainReaders() {
  console.log('\n🔹 Testing On-chain Readers...');
  
  try {
    // Test token metadata
    const wflr = await readTokenMetadata(TOKEN_ADDRESSES.WFLR);
    if (!wflr || wflr.symbol !== 'WFLR') throw new Error('Failed to read WFLR metadata');
    console.log(`✅ Token metadata: ${wflr.symbol} (${wflr.decimals} decimals)`);

    // Test position data
    const position = await readPositionData(BigInt(22003));
    if (!position) throw new Error('Failed to read position 22003');
    console.log(`✅ Position 22003: liquidity=${position.liquidity}, fee=${position.fee}`);
  } catch (error) {
    console.error('❌ On-chain Readers test failed:', error);
    throw error;
  }
}

async function testFlarescanAdapter() {
  console.log('\n🔹 Testing FlareScan Adapter...');
  
  try {
    // Test contract creation
    const creation = await getContractCreation(ENOSYS_ADDRESSES.POSITION_MANAGER);
    if (!creation.result || creation.result.length === 0) {
      throw new Error('Failed to get contract creation');
    }
    console.log(`✅ Contract created in tx: ${creation.result[0].txHash.slice(0, 10)}...`);

    // Test NFT transfers (rate-limited, so be patient)
    console.log('   Fetching NFT transfers (rate-limited)...');
    const transfers = await getNFTInstanceTransfers(
      ENOSYS_ADDRESSES.POSITION_MANAGER,
      '22003',
      1,
      10
    );
    if (!transfers.items) throw new Error('Failed to get NFT transfers');
    console.log(`✅ NFT transfers for position 22003: ${transfers.items.length} found`);
  } catch (error) {
    console.error('❌ FlareScan Adapter test failed:', error);
    throw error;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 PHASE 1 INTEGRATION TEST');
  console.log('='.repeat(60));

  try {
    await testRpcClient();
    await testOnchainReaders();
    await testFlarescanAdapter();

    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL PHASE 1 TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\nPhase 1 foundation is solid and ready for Phase 2.');
    console.log('Next: Discovery + Ingestion (wallet positions, events, etc.)');
    console.log('');
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ PHASE 1 TESTS FAILED');
    console.log('='.repeat(60));
    console.error(error);
    process.exit(1);
  }
}

main();

