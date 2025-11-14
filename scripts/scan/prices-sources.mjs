#!/usr/bin/env node

/**
 * Price Sources Scanner
 * 
 * Scans src/** for forbidden price-fetching patterns:
 * - Direct DexScreener API calls for prices: api.dexscreener.com/latest/dex/tokens
 * - Legacy ANKR price endpoint imports/usage: /api/prices/ankr
 * 
 * Exits 1 if any forbidden patterns are found.
 * Icon/metadata fetches are allowed (context: imageUrl, icon, fetchTokenIcon).
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '../..');
const srcDir = join(root, 'src');

const FORBIDDEN_PATTERNS = [
  {
    regex: /https:\/\/api\.dexscreener\.com\/latest\/dex\/tokens/,
    name: 'Dexscreener API price fetch',
    allowedContext: ['imageUrl', 'icon', 'metadata', 'fetchTokenIcon'],
  },
  {
    regex: /api\.dexscreener\.com\/latest\/dex\/tokens/,
    name: 'Dexscreener API price fetch',
    allowedContext: ['imageUrl', 'icon', 'metadata', 'fetchTokenIcon'],
  },
  {
    regex: /['"`]\/api\/prices\/ankr['"`]/,
    name: 'Legacy /api/prices/ankr endpoint',
    allowedContext: [],
  },
  {
    regex: /from\s+['"`].*\/api\/prices\/ankr/,
    name: 'Legacy /api/prices/ankr import',
    allowedContext: [],
  },
  {
    regex: /import.*\/api\/prices\/ankr/,
    name: 'Legacy /api/prices/ankr import',
    allowedContext: [],
  },
  {
    regex: /require\s*\(['"`].*\/api\/prices\/ankr/,
    name: 'Legacy /api/prices/ankr require',
    allowedContext: [],
  },
  {
    regex: /fetch\s*\(['"`].*\/api\/prices\/ankr/,
    name: 'Legacy /api/prices/ankr fetch',
    allowedContext: [],
  },
];

function scanDirectory(dir) {
  const findings = [];
  
  function walk(currentPath) {
    const entries = readdirSync(currentPath);
    
    for (const entry of entries) {
      const fullPath = join(currentPath, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === '.next' || entry === 'out') {
          continue;
        }
        walk(fullPath);
      } else if (stat.isFile()) {
        const ext = entry.split('.').pop();
        if (['ts', 'tsx', 'js', 'jsx', 'mjs'].includes(ext)) {
          const content = readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            for (const pattern of FORBIDDEN_PATTERNS) {
              if (pattern.regex.test(line)) {
                // Check if this line or surrounding context contains allowed keywords
                // Check previous 10 lines for function context (e.g., fetchTokenIcon)
                const contextWindow = [
                  ...lines.slice(Math.max(0, i - 10), i),
                  ...lines.slice(i, Math.min(i + 6, lines.length))
                ].join('\n');
                const isAllowed = pattern.allowedContext.some(ctx => contextWindow.includes(ctx));
                if (!isAllowed) {
                  findings.push({
                    file: relative(root, fullPath),
                    line: i + 1,
                    pattern: pattern.name,
                    snippet: line.trim(),
                  });
                }
              }
            }
          }
        }
      }
    }
  }
  
  walk(dir);
  return findings;
}

console.log('[scan:prices] Scanning src/ for forbidden price sources...');

const findings = scanDirectory(srcDir);

if (findings.length === 0) {
  console.log('[scan:prices] ✅ No forbidden price sources found');
  process.exit(0);
}

console.error('[scan:prices] ❌ Forbidden price sources detected:');
console.error('');

for (const finding of findings) {
  console.error(`  ${finding.file}:${finding.line}`);
  console.error(`    Pattern: ${finding.pattern}`);
  console.error(`    Snippet: ${finding.snippet}`);
  console.error('');
}

console.error(`[scan:prices] Found ${findings.length} violation(s)`);
console.error('[scan:prices] Replace with: /api/prices/current?symbols=SYMBOL1,SYMBOL2');
process.exit(1);
