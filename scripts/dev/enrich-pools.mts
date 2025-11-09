#!/usr/bin/env node
/**
 * Enrich Pool Metadata
 * 
 * Reads PoolCreated events from PoolEvent table and enriches Pool table with:
 * - Token symbols (e.g. "WFLR", "USDT")
 * - Token names (e.g. "Wrapped Flare")
 * - Token decimals
 * 
 * Usage:
 *   tsx scripts/dev/enrich-pools.mts [--limit=100] [--offset=0]
 */

import { PrismaClient } from '@prisma/client';
import { createPublicClient, http, getContract, type Address } from 'viem';
import { flare } from 'viem/chains';

const prisma = new PrismaClient();

// ERC-20 ABI (minimal - only what we need)
const ERC20_ABI = [
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const;

// Get RPC URL from env
const RPC_URL = process.env.FLARE_RPC_URL || process.env.ANKR_HTTP_URL || 'https://flare-api.flare.network/ext/bc/C/rpc';

const client = createPublicClient({
  chain: flare,
  transport: http(RPC_URL),
});

interface TokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
}

/**
 * Fetch token metadata from blockchain
 */
async function getTokenMetadata(tokenAddress: Address): Promise<TokenMetadata | null> {
  try {
    const contract = getContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      client,
    });

    const [symbol, name, decimals] = await Promise.all([
      contract.read.symbol(),
      contract.read.name(),
      contract.read.decimals(),
    ]);

    return { symbol, name, decimals };
  } catch (error) {
    console.warn(`⚠️  Failed to fetch metadata for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Parse PoolCreated event metadata from JSON
 */
function parsePoolCreatedMetadata(event: any): { token0: string; token1: string; fee: number; factory: string } | null {
  try {
    // metadata should contain: { token0, token1, fee, tickSpacing }
    const meta = event.metadata;
    if (!meta || !meta.token0 || !meta.token1 || meta.fee === undefined) {
      return null;
    }

    return {
      token0: meta.token0.toLowerCase(),
      token1: meta.token1.toLowerCase(),
      fee: Number(meta.fee),
      factory: meta.factory?.toLowerCase() || 'unknown',
    };
  } catch (error) {
    console.warn(`⚠️  Failed to parse metadata for event ${event.id}:`, error);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '500');
  const offset = parseInt(args.find(a => a.startsWith('--offset='))?.split('=')[1] || '0');

  console.log(`\n🔍 Enriching pools (limit=${limit}, offset=${offset})...\n`);

  // Fetch pools that need enrichment (token0Symbol is NULL)
  const poolsToEnrich = await prisma.pool.findMany({
    where: {
      token0Symbol: null,
    },
    orderBy: {
      blockNumber: 'asc',
    },
    take: limit,
    skip: offset,
  });

  console.log(`✓ Found ${poolsToEnrich.length} pools needing enrichment\n`);

  let processed = 0;
  let enriched = 0;
  let skipped = 0;
  let errors = 0;

  for (const pool of poolsToEnrich) {
    processed++;

    // Skip if already enriched
    if (pool.token0Symbol && pool.token1Symbol) {
      console.log(`⊙ [${processed}/${poolsToEnrich.length}] Skip ${pool.address} (already enriched)`);
      skipped++;
      continue;
    }

    // Fetch token metadata
    console.log(`⟳ [${processed}/${poolsToEnrich.length}] Enriching ${pool.address}...`);

    const [meta0, meta1] = await Promise.all([
      getTokenMetadata(pool.token0 as Address),
      getTokenMetadata(pool.token1 as Address),
    ]);

    if (!meta0 || !meta1) {
      console.log(`  ⚠️  Failed to fetch token metadata`);
      errors++;
      continue;
    }

    // Update pool with token metadata
    try {
      await prisma.pool.update({
        where: { address: pool.address },
        data: {
          token0Symbol: meta0.symbol,
          token1Symbol: meta1.symbol,
          token0Name: meta0.name,
          token1Name: meta1.name,
          token0Decimals: meta0.decimals,
          token1Decimals: meta1.decimals,
        },
      });

      const displayName = `${meta0.symbol}/${meta1.symbol} (${pool.fee / 10000}%)`;
      console.log(`  ✓ ${displayName}`);
      enriched++;
    } catch (error) {
      console.error(`  ✗ Failed to update pool:`, error);
      errors++;
    }

    // Rate limit: 100ms delay between pools to avoid RPC throttling
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Processed: ${processed}`);
  console.log(`✅ Enriched: ${enriched}`);
  console.log(`⊙ Skipped: ${skipped}`);
  console.log(`⚠️  Errors: ${errors}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

