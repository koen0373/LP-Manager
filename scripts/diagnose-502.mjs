#!/usr/bin/env node
/**
 * Diagnose 502 errors - Test endpoints and log response details
 * 
 * Usage: BASE_URL=https://app.liquilab.io node scripts/diagnose-502.mjs
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

if (!BASE_URL) {
  console.error('❌ BASE_URL environment variable is required');
  process.exit(1);
}

async function diagnose() {
  console.log(`🔍 Diagnosing ${BASE_URL}...\n`);

  const endpoints = ['/', '/api/health'];

  for (const endpoint of endpoints) {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`📡 Testing ${endpoint}`);

    for (let i = 0; i < 5; i++) {
      try {
        const start = Date.now();
        const response = await fetch(url, {
          signal: AbortSignal.timeout(10000),
        });
        const duration = Date.now() - start;

        const via = response.headers.get('via');
        const server = response.headers.get('server');
        const xVia = response.headers.get('x-via');

        console.log(`  Request ${i + 1}:`);
        console.log(`    Status: ${response.status} ${response.statusText}`);
        console.log(`    Time: ${duration}ms`);
        if (via) console.log(`    Via: ${via}`);
        if (server) console.log(`    Server: ${server}`);
        if (xVia) console.log(`    X-Via: ${xVia}`);
        console.log('');

        // Try to read body for health endpoint
        if (endpoint === '/api/health' && response.ok) {
          try {
            const body = await response.json();
            console.log(`    Body:`, JSON.stringify(body, null, 2));
            console.log('');
          } catch {
            // Ignore JSON parse errors
          }
        }
      } catch (error) {
        const duration = Date.now() - Date.now();
        console.log(`  Request ${i + 1}:`);
        console.log(`    ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        console.log(`    Time: ${duration}ms`);
        console.log('');
      }

      // Small delay between requests
      if (i < 4) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  console.log('✅ Diagnosis complete');
}

diagnose().catch((error) => {
  console.error('❌ Diagnosis failed:', error);
  process.exit(1);
});

