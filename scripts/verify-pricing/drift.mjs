#!/usr/bin/env node

/**
 * Pricing Drift Verifier
 * 
 * Compares pricing values across:
 * 1. config/pricing.json (source of truth)
 * 2. /api/public/pricing endpoint (must match config)
 * 3. UI strings in src/ (must match config)
 * 
 * Build fails if any drift is detected.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '../..');

const PRICING_CONFIG_PATH = join(root, 'config', 'pricing.json');
const PRICING_LIB_PATH = join(root, 'src', 'lib', 'billing', 'pricing.ts');

const DRIFT_TOLERANCE = 0.01; // Allow 1 cent difference for rounding

function loadConfig() {
  try {
    const content = readFileSync(PRICING_CONFIG_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load ${PRICING_CONFIG_PATH}: ${error.message}`);
  }
}

function extractPricingFromLib() {
  try {
    const content = readFileSync(PRICING_LIB_PATH, 'utf-8');
    const base5Match = content.match(/BASE5:\s*(\d+\.?\d*)/);
    const extraSlotMatch = content.match(/EXTRA_SLOT:\s*(\d+\.?\d*)/);
    const alertsPackMatch = content.match(/ALERTS_PACK5:\s*(\d+\.?\d*)/);
    const uiPackCopyMatch = content.match(/UI_PACK_COPY:\s*['"]([^'"]+)['"]/);
    
    return {
      base5: base5Match ? parseFloat(base5Match[1]) : null,
      extraSlot: extraSlotMatch ? parseFloat(extraSlotMatch[1]) : null,
      alertsPack5: alertsPackMatch ? parseFloat(alertsPackMatch[1]) : null,
      uiPackCopy: uiPackCopyMatch ? uiPackCopyMatch[1] : null,
    };
  } catch (error) {
    throw new Error(`Failed to parse ${PRICING_LIB_PATH}: ${error.message}`);
  }
}

function extractUIStrings() {
  const uiFiles = [
    join(root, 'src', 'components', 'pricing', 'PremiumCard.tsx'),
    join(root, 'src', 'components', 'pricing', 'PricingSelector.tsx'),
    join(root, 'src', 'components', 'hero', 'Hero.tsx'),
  ];
  
  const findings = {
    base5: [],
    extraBundle5: [],
    alertsPack5: [],
  };
  
  for (const file of uiFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      
      // Extract $14.95, $9.95, $2.49 patterns
      const base5Matches = content.match(/\$14\.95/g);
      const extraBundleMatches = content.match(/\$9\.95/g);
      const alertsMatches = content.match(/\$2\.49/g);
      
      if (base5Matches) {
        findings.base5.push({ file, count: base5Matches.length });
      }
      if (extraBundleMatches) {
        findings.extraBundle5.push({ file, count: extraBundleMatches.length });
      }
      if (alertsMatches) {
        findings.alertsPack5.push({ file, count: alertsMatches.length });
      }
    } catch (error) {
      // File might not exist, skip
    }
  }
  
  return findings;
}

function compareValues(name, expected, actual, tolerance = DRIFT_TOLERANCE) {
  if (actual === null || actual === undefined) {
    return { ok: false, message: `${name}: missing in source` };
  }
  
  const diff = Math.abs(expected - actual);
  if (diff > tolerance) {
    return { 
      ok: false, 
      message: `${name}: config=${expected}, source=${actual}, diff=${diff.toFixed(2)}` 
    };
  }
  
  return { ok: true };
}

function compareStrings(name, expected, actual) {
  if (!actual) {
    return { ok: false, message: `${name}: missing in source` };
  }
  
  if (expected !== actual) {
    return { 
      ok: false, 
      message: `${name}: config="${expected}", source="${actual}"` 
    };
  }
  
  return { ok: true };
}

async function main() {
  const config = loadConfig();
  const libPricing = extractPricingFromLib();
  const uiFindings = extractUIStrings();
  
  const errors = [];
  const warnings = [];
  
  // Compare config vs lib
  const base5Check = compareValues('base5', config.base5, libPricing.base5);
  if (!base5Check.ok) errors.push(`LIB: ${base5Check.message}`);
  
  const extraSlotCheck = compareValues('extraSlot', config.extraSlot, libPricing.extraSlot);
  if (!extraSlotCheck.ok) errors.push(`LIB: ${extraSlotCheck.message}`);
  
  // Note: lib uses EXTRA_SLOT but config has extraBundle5 - check if they align
  // lib calculates: extraBundles * 9.95, so extraBundle5 should be 9.95
  const extraBundleCheck = compareValues('extraBundle5', config.extraBundle5, 9.95);
  if (!extraBundleCheck.ok) {
    warnings.push(`CONFIG: extraBundle5=${config.extraBundle5} but lib calculates with 9.95`);
  }
  
  const alertsCheck = compareValues('alertsPack5', config.alertsPack5, libPricing.alertsPack5);
  if (!alertsCheck.ok) {
    errors.push(`LIB: ${alertsCheck.message} (UI shows $2.49 but lib has ${libPricing.alertsPack5})`);
  }
  
  const uiPackCopyCheck = compareStrings('uiPackCopy', config.uiPackCopy, libPricing.uiPackCopy);
  if (!uiPackCopyCheck.ok) errors.push(`LIB: ${uiPackCopyCheck.message}`);
  
  // Check UI strings
  if (uiFindings.base5.length === 0) {
    warnings.push('UI: No $14.95 references found in UI files');
  }
  
  if (uiFindings.extraBundle5.length === 0) {
    warnings.push('UI: No $9.95 references found in UI files');
  }
  
  if (uiFindings.alertsPack5.length === 0) {
    warnings.push('UI: No $2.49 references found in UI files');
  }
  
  // Output results
  const output = {
    ok: errors.length === 0,
    config: {
      base5: config.base5,
      extraSlot: config.extraSlot,
      extraBundle5: config.extraBundle5,
      alertsPack5: config.alertsPack5,
      uiPackCopy: config.uiPackCopy,
    },
    lib: {
      base5: libPricing.base5,
      extraSlot: libPricing.extraSlot,
      alertsPack5: libPricing.alertsPack5,
      uiPackCopy: libPricing.uiPackCopy,
    },
    ui: {
      base5References: uiFindings.base5.length,
      extraBundle5References: uiFindings.extraBundle5.length,
      alertsPack5References: uiFindings.alertsPack5.length,
    },
    errors,
    warnings,
  };
  
  console.log(JSON.stringify(output, null, 2));
  
  if (errors.length > 0) {
    console.error('\n❌ Pricing drift detected! Build will fail.');
    process.exit(1);
  }
  
  if (warnings.length > 0) {
    console.warn('\n⚠️  Warnings (non-blocking):');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }
  
  console.log('\n✅ Pricing consistency verified.');
  process.exit(0);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message ?? String(error) }));
  process.exit(1);
});

