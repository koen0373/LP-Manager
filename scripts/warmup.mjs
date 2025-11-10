#!/usr/bin/env node
/**
 * Warmup script - Ping health and root endpoints after deployment
 * 
 * Useful for post-deploy verification but not required at runtime.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function warmup() {
  console.log(`🔥 Warming up ${BASE_URL}...\n`);

  const endpoints = ['/api/health', '/'];

  for (const endpoint of endpoints) {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`📡 Pinging ${endpoint}...`);

    for (let i = 0; i < 3; i++) {
      try {
        const start = Date.now();
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000),
        });
        const duration = Date.now() - start;

        if (response.ok) {
          console.log(`  ✅ Attempt ${i + 1}: ${response.status} (${duration}ms)`);
        } else {
          console.log(`  ⚠️  Attempt ${i + 1}: ${response.status} (${duration}ms)`);
        }
      } catch (error) {
        console.log(`  ❌ Attempt ${i + 1}: ${error instanceof Error ? error.message : 'Failed'}`);
      }

      if (i < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    console.log('');
  }

  console.log('✅ Warmup complete');
}

warmup().catch((error) => {
  console.error('❌ Warmup failed:', error);
  process.exit(1);
});

