/**
 * Test script for tokenPriceService
 * Tests CoinGecko API integration and fallback strategies
 */

import { getTokenPriceUsd, getTokenPriceWithFallback } from './src/services/tokenPriceService';

async function testPriceService() {
  console.log('🧪 Testing Token Price Service\n');
  console.log('═'.repeat(60));
  
  // Test 1: Major tokens (should use CoinGecko)
  console.log('\n📊 TEST 1: Major Tokens (CoinGecko API)');
  console.log('─'.repeat(60));
  
  const majorTokens = ['WFLR', 'USDT', 'USDC', 'WETH'];
  for (const symbol of majorTokens) {
    const price = await getTokenPriceUsd(symbol);
    console.log(`  ${symbol}: $${price?.toFixed(6) ?? 'null'}`);
  }
  
  // Test 2: Stablecoin variants (should use $1.00 fallback)
  console.log('\n💵 TEST 2: Stablecoin Variants (Fallback)');
  console.log('─'.repeat(60));
  
  const stablecoins = ['USDC.e', 'eUSDT', 'USD₮0'];
  for (const symbol of stablecoins) {
    const { price, source } = await getTokenPriceWithFallback(symbol, 1.0);
    console.log(`  ${symbol}: $${price.toFixed(2)} (source: ${source})`);
  }
  
  // Test 3: Unknown token (should use pool ratio fallback)
  console.log('\n⚠️  TEST 3: Unknown Token (Pool Ratio Fallback)');
  console.log('─'.repeat(60));
  
  const { price, source } = await getTokenPriceWithFallback('UNKNOWNTOKEN', 1.25);
  console.log(`  UNKNOWNTOKEN: $${price.toFixed(2)} (source: ${source})`);
  
  // Test 4: Cache performance
  console.log('\n🚀 TEST 4: Cache Performance');
  console.log('─'.repeat(60));
  
  // First call (cache miss)
  console.time('  First call (cache miss)');
  await getTokenPriceUsd('WFLR');
  console.timeEnd('  First call (cache miss)');
  
  // Second call (cache hit)
  console.time('  Second call (cache hit)');
  await getTokenPriceUsd('WFLR');
  console.timeEnd('  Second call (cache hit)');
  
  console.log(`  (Cache stats available in service logs)`);
  
  // Test 5: sFLR (Flare-specific token)
  console.log('\n🔥 TEST 5: Flare-Specific Tokens');
  console.log('─'.repeat(60));
  
  const flareTokens = ['SFLR', 'FXRP', 'HLN', 'SPX'];
  for (const symbol of flareTokens) {
    const { price, source } = await getTokenPriceWithFallback(symbol, 0.99);
    console.log(`  ${symbol}: $${price?.toFixed(6) ?? 'fallback'} (source: ${source})`);
  }
  
  console.log('\n═'.repeat(60));
  console.log('✅ All tests completed!\n');
}

testPriceService().catch(console.error);

