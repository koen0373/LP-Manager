#!/usr/bin/env node
/**
 * Remote Icon Probe
 * 
 * Probes Dexscreener icon URLs and reports availability statistics.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const DEXS_BASE = 'https://static.dexscreener.com/token-icons';
const DEFAULT_CHAIN = 'flare';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    chain: process.env.CHAIN_SLUG || DEFAULT_CHAIN,
    in: process.env.TOKENS_JSON || 'data/flare.tokens.json',
    limit: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--chain' && args[i + 1]) opts.chain = args[++i];
    else if (arg === '--in' && args[i + 1]) opts.in = args[++i];
    else if (arg === '--limit' && args[i + 1]) opts.limit = parseInt(args[++i], 10);
  }

  return opts;
}

async function probeUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.status;
  } catch (e) {
    return 0;
  }
}

async function main() {
  const opts = parseArgs();
  
  const tokensJson = await fs.readFile(opts.in, 'utf8');
  const manifest = JSON.parse(tokensJson);
  
  let tokens = manifest.tokens || [];
  if (opts.limit) {
    tokens = tokens.slice(0, opts.limit);
  }
  
  console.log(`\n🔍 Probing ${tokens.length} token icons...`);
  
  const stats = { '200': 0, '404': 0, 'other': 0, 'error': 0 };
  const results = [];
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const address = token.address.toLowerCase();
    const url = `${DEXS_BASE}/${opts.chain}/${address}.png`;
    
    const status = await probeUrl(url);
    
    if (status === 200) stats['200']++;
    else if (status === 404) stats['404']++;
    else if (status > 0) stats['other']++;
    else stats['error']++;
    
    results.push({ address, symbol: token.symbol, status });
    
    if ((i + 1) % 50 === 0) {
      console.log(`   Progress: ${i + 1}/${tokens.length}`);
    }
  }
  
  const summary = {
    chain: opts.chain,
    probed: tokens.length,
    stats,
    availability: ((stats['200'] / tokens.length) * 100).toFixed(1) + '%',
  };
  
  console.log(`\n📊 Probe Summary:`);
  console.log(JSON.stringify(summary, null, 2));
  
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});

