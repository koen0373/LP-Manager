#!/usr/bin/env node
/**
 * Verify pricing calculations against examples in config/pricing.json
 * 
 * Exits with non-zero code if validation fails.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Simple pricing calculation (matches lib/pricing.ts logic)
function calculatePrice(plan, pools, alerts, config) {
  const planConfig = config.plans[plan];
  if (!planConfig) {
    throw new Error(`Plan "${plan}" not found`);
  }

  const bundleSize = config.bundles.size_pools;
  const totalBundles = Math.ceil(pools / bundleSize);
  const bundlesIncluded = planConfig.bundles_included || 0;
  const extraBundles = Math.max(0, totalBundles - bundlesIncluded);

  const base = planConfig.price || 0;
  const extraBundlePrice = planConfig.extra_bundle_price || 0;
  const extraBundlesCost = extraBundles * extraBundlePrice;

  const alertsBundlePrice = planConfig.alerts_bundle_price || 0;
  const alertBundles = alerts ? totalBundles : 0;
  const alertsCost = alertBundles * alertsBundlePrice;

  const total = base + extraBundlesCost + alertsCost;
  return Math.round(total * 100) / 100;
}

// Load config
const configPath = join(projectRoot, 'config', 'pricing.json');
const config = JSON.parse(readFileSync(configPath, 'utf-8'));

console.log('🔍 Verifying pricing calculations...\n');

let failed = false;

for (const example of config.examples) {
  const calculated = calculatePrice(
    example.plan,
    example.pools,
    example.alerts,
    config
  );

  const diff = Math.abs(calculated - example.expected_total);
  const passed = diff < 0.01;

  if (!passed) {
    console.error(
      `❌ FAILED: ${example.plan} (${example.pools} pools, alerts: ${example.alerts})\n` +
      `   Expected: $${example.expected_total}\n` +
      `   Got:      $${calculated}\n` +
      `   Diff:     $${diff.toFixed(2)}\n`
    );
    failed = true;
  } else {
    console.log(
      `✅ PASSED: ${example.plan} (${example.pools} pools, alerts: ${example.alerts}) = $${calculated}`
    );
  }
}

console.log('');

if (failed) {
  console.error('❌ Pricing verification failed!');
  process.exit(1);
} else {
  console.log('✅ All pricing examples verified successfully!');
  process.exit(0);
}

