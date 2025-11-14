#!/usr/bin/env node

/**
 * API Verifier: /api/prices/current
 * 
 * Verifies the /api/prices/current endpoint returns valid responses for critical symbols:
 * - FXRP (wrapped XRP on Flare)
 * - USDT0 (USDT variant with special chars)
 * - WFLR (wrapped Flare)
 * 
 * Asserts:
 * - 200 OK status
 * - JSON response with { ok: true, ts, prices: [{symbol, priceUsd, source}] }
 * - At least 2 numeric prices returned (allows 1 missing)
 * - Logs warnings if symbols are unavailable
 */

const BASE_URL = process.env.VERIFY_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const TEST_SYMBOLS = ['FXRP', 'USDT0', 'WFLR'];
const MIN_REQUIRED_PRICES = 2;

async function verifyEndpoint() {
  const url = `${BASE_URL}/api/prices/current?symbols=${TEST_SYMBOLS.join(',')}`;
  
  console.log(`[verify:api:prices] Testing: ${url}`);
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Validate response structure
    if (!data.ok) {
      throw new Error(`Response has ok=false: ${JSON.stringify(data)}`);
    }
    
    if (!data.ts || typeof data.ts !== 'string') {
      throw new Error('Missing or invalid ts field');
    }
    
    if (!Array.isArray(data.prices)) {
      throw new Error('prices field is not an array');
    }
    
    // Validate each price entry
    for (const entry of data.prices) {
      if (!entry.symbol || typeof entry.symbol !== 'string') {
        throw new Error(`Invalid symbol in entry: ${JSON.stringify(entry)}`);
      }
      
      if (typeof entry.priceUsd !== 'number' || !Number.isFinite(entry.priceUsd)) {
        throw new Error(`Invalid priceUsd for ${entry.symbol}: ${entry.priceUsd}`);
      }
      
      if (entry.priceUsd <= 0) {
        throw new Error(`Non-positive price for ${entry.symbol}: ${entry.priceUsd}`);
      }
      
      if (entry.source !== 'coingecko') {
        throw new Error(`Invalid source for ${entry.symbol}: ${entry.source}`);
      }
    }
    
    // Validate minimum required prices
    if (data.prices.length < MIN_REQUIRED_PRICES) {
      throw new Error(
        `Too few prices returned: ${data.prices.length}/${TEST_SYMBOLS.length} ` +
        `(minimum ${MIN_REQUIRED_PRICES} required)`
      );
    }
    
    const returnedSymbols = data.prices.map(p => p.symbol);
    
    console.log(`[verify:api:prices] ✅ OK`);
    console.log(`  Returned: ${returnedSymbols.join(', ')}`);
    console.log(`  Prices: ${data.prices.map(p => `${p.symbol}=$${p.priceUsd.toFixed(4)}`).join(', ')}`);
    console.log(`  Timestamp: ${data.ts}`);
    
    if (data.warnings && data.warnings.length > 0) {
      console.log(`  ⚠️  Warnings: ${data.warnings.join('; ')}`);
    }
    
    // Check for specific expected symbols
    const expectedSymbols = ['FXRP', 'USDT0', 'WFLR'];
    const missing = expectedSymbols.filter(s => !returnedSymbols.includes(s));
    if (missing.length > 0) {
      console.log(`  ℹ️  Missing symbols (acceptable): ${missing.join(', ')}`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error(`[verify:api:prices] ❌ FAILED`);
    console.error(`  Error: ${error.message}`);
    process.exit(1);
  }
}

verifyEndpoint();
