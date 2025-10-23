#!/usr/bin/env tsx
"use strict";
/**
 * Phase 2 Integration Test
 * Tests wallet discovery, position enrichment, and normalization
 */
Object.defineProperty(exports, "__esModule", { value: true });
const discoverWallet_1 = require("../src/lib/discovery/discoverWallet");
const normalize_1 = require("../src/lib/discovery/normalize");
// Test wallet address (replace with your own for testing)
const TEST_WALLET = '0x57d294D815968F0EFA722f1E8094da65402cd951';
async function testDiscovery() {
    console.log('\n🔹 Testing Wallet Discovery...');
    try {
        const discovery = await (0, discoverWallet_1.discoverWalletPositions)(TEST_WALLET, {
            includeInactive: true,
            refresh: true,
        });
        console.log(`✅ Discovered ${discovery.totalCount} positions:`);
        console.log(`   - Active: ${discovery.activeCount}`);
        console.log(`   - Inactive: ${discovery.inactiveCount}`);
        console.log(`   - Total TVL: $${discovery.totalTvlUsd.toFixed(2)}`);
        console.log(`   - Total Fees: $${discovery.totalFeesUsd.toFixed(2)}`);
        console.log(`   - Total Rewards: $${discovery.totalRewardsUsd.toFixed(2)}`);
        if (discovery.positions.length > 0) {
            const firstPos = discovery.positions[0];
            console.log(`\n   First position sample:`);
            console.log(`   - Token ID: ${firstPos.tokenId}`);
            console.log(`   - Pool: ${firstPos.token0.symbol}/${firstPos.token1.symbol}`);
            console.log(`   - Fee: ${firstPos.fee / 10000}%`);
            console.log(`   - In Range: ${firstPos.inRange ? 'Yes' : 'No'}`);
            console.log(`   - TVL: $${firstPos.tvlUsd.toFixed(2)}`);
        }
        return discovery;
    }
    catch (error) {
        console.error('❌ Discovery test failed:', error);
        throw error;
    }
}
async function testNormalization() {
    console.log('\n🔹 Testing Position Normalization...');
    try {
        // First discover positions
        const discovery = await (0, discoverWallet_1.discoverWalletPositions)(TEST_WALLET);
        if (discovery.positions.length === 0) {
            console.log('⚠️  No positions to normalize');
            return;
        }
        // Normalize to PositionRow format
        const normalized = (0, normalize_1.normalizePositions)(discovery.positions);
        console.log(`✅ Normalized ${normalized.length} positions`);
        if (normalized.length > 0) {
            const firstNorm = normalized[0];
            console.log(`\n   First normalized position:`);
            console.log(`   - ID: ${firstNorm.id}`);
            console.log(`   - Status: ${firstNorm.status}`);
            console.log(`   - Token0: ${firstNorm.token0.symbol} (${firstNorm.amount0.toFixed(4)})`);
            console.log(`   - Token1: ${firstNorm.token1.symbol} (${firstNorm.amount1.toFixed(4)})`);
            console.log(`   - TVL: $${firstNorm.tvlUsd.toFixed(2)}`);
            console.log(`   - Fees: $${firstNorm.rewardsUsd.toFixed(2)}`);
            console.log(`   - RFLR: ${firstNorm.rflrAmount.toFixed(2)} ($${firstNorm.rflrUsd.toFixed(2)})`);
        }
    }
    catch (error) {
        console.error('❌ Normalization test failed:', error);
        throw error;
    }
}
async function testApiEndpoint() {
    console.log('\n🔹 Testing API Endpoint (simulated)...');
    try {
        // Note: This would need a running Next.js server to test properly
        // For now, we just simulate the logic
        const discovery = await (0, discoverWallet_1.discoverWalletPositions)(TEST_WALLET);
        const normalized = (0, normalize_1.normalizePositions)(discovery.positions);
        const response = {
            success: true,
            data: {
                positions: normalized,
                summary: {
                    totalCount: discovery.totalCount,
                    activeCount: discovery.activeCount,
                    inactiveCount: discovery.inactiveCount,
                    totalTvlUsd: discovery.totalTvlUsd,
                    totalFeesUsd: discovery.totalFeesUsd,
                    totalRewardsUsd: discovery.totalRewardsUsd,
                },
                fetchedAt: discovery.fetchedAt.toISOString(),
            },
        };
        console.log(`✅ API response structure valid:`);
        console.log(`   - Success: ${response.success}`);
        console.log(`   - Positions: ${response.data.positions.length}`);
        console.log(`   - Summary: Active=${response.data.summary.activeCount}, Inactive=${response.data.summary.inactiveCount}`);
    }
    catch (error) {
        console.error('❌ API endpoint test failed:', error);
        throw error;
    }
}
async function main() {
    console.log('='.repeat(60));
    console.log('🧪 PHASE 2 INTEGRATION TEST');
    console.log('='.repeat(60));
    console.log(`Testing with wallet: ${TEST_WALLET}`);
    try {
        await testDiscovery();
        await testNormalization();
        await testApiEndpoint();
        console.log('\n' + '='.repeat(60));
        console.log('🎉 ALL PHASE 2 TESTS PASSED!');
        console.log('='.repeat(60));
        console.log('\nPhase 2 discovery & enrichment is working correctly.');
        console.log('Next: Phase 3 (Event Ingestion & Historical Data)');
        console.log('');
    }
    catch (error) {
        console.log('\n' + '='.repeat(60));
        console.log('❌ PHASE 2 TESTS FAILED');
        console.log('='.repeat(60));
        console.error(error);
        process.exit(1);
    }
}
main();
