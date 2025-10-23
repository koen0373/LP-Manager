#!/usr/bin/env tsx
"use strict";
/**
 * Phase 1 Integration Test
 * Tests RPC client, on-chain readers, and FlareScan adapter
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../src/lib/onchain/index.js");
const index_js_2 = require("../src/lib/adapters/flarescan/index.js");
const config_js_1 = require("../src/lib/onchain/config.js");
async function testRpcClient() {
    console.log('\n🔹 Testing RPC Client...');
    try {
        const blockNumber = await (0, index_js_1.readLatestBlockNumber)();
        if (!blockNumber)
            throw new Error('Failed to get latest block number');
        console.log(`✅ Latest block: ${blockNumber}`);
    }
    catch (error) {
        console.error('❌ RPC Client test failed:', error);
        throw error;
    }
}
async function testOnchainReaders() {
    console.log('\n🔹 Testing On-chain Readers...');
    try {
        // Test token metadata
        const wflr = await (0, index_js_1.readTokenMetadata)(config_js_1.TOKEN_ADDRESSES.WFLR);
        if (!wflr || wflr.symbol !== 'WFLR')
            throw new Error('Failed to read WFLR metadata');
        console.log(`✅ Token metadata: ${wflr.symbol} (${wflr.decimals} decimals)`);
        // Test position data
        const position = await (0, index_js_1.readPositionData)(BigInt(22003));
        if (!position)
            throw new Error('Failed to read position 22003');
        console.log(`✅ Position 22003: liquidity=${position.liquidity}, fee=${position.fee}`);
    }
    catch (error) {
        console.error('❌ On-chain Readers test failed:', error);
        throw error;
    }
}
async function testFlarescanAdapter() {
    console.log('\n🔹 Testing FlareScan Adapter...');
    try {
        // Test contract creation
        const creation = await (0, index_js_2.getContractCreation)(config_js_1.ENOSYS_ADDRESSES.POSITION_MANAGER);
        if (!creation.result || creation.result.length === 0) {
            throw new Error('Failed to get contract creation');
        }
        console.log(`✅ Contract created in tx: ${creation.result[0].txHash.slice(0, 10)}...`);
        // Test NFT transfers (rate-limited, so be patient)
        console.log('   Fetching NFT transfers (rate-limited)...');
        const transfers = await (0, index_js_2.getNFTInstanceTransfers)(config_js_1.ENOSYS_ADDRESSES.POSITION_MANAGER, '22003', 1, 10);
        if (!transfers.items)
            throw new Error('Failed to get NFT transfers');
        console.log(`✅ NFT transfers for position 22003: ${transfers.items.length} found`);
    }
    catch (error) {
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
    }
    catch (error) {
        console.log('\n' + '='.repeat(60));
        console.log('❌ PHASE 1 TESTS FAILED');
        console.log('='.repeat(60));
        console.error(error);
        process.exit(1);
    }
}
main();
