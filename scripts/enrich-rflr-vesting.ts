#!/usr/bin/env tsx
/**
 * rFLR Vesting Calculation Enrichment Script
 * 
 * rFLR rewards worden niet direct geclaimd maar gevest via Flare Portal:
 * - Lineair gevest over 12 maanden
 * - Vroegtijdig claim mogelijk met 50% boete op niet-gevestigd deel
 * 
 * Dit script:
 * 1. Haalt rFLR rewards op via Enosys API
 * 2. Berekent gevestigde hoeveelheid (lineair over 12 maanden)
 * 3. Berekent claimable waarde (gevestigd + vroegtijdig met boete)
 * 4. Update PositionEvent metadata met vesting info
 * 
 * Usage:
 *   npx tsx scripts/enrich-rflr-vesting.ts [--limit=200] [--offset=0]
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Parse CLI args
const args = new Map(
  process.argv.slice(2).flatMap((kv) => {
    const [k, v] = kv.replace(/^--/, '').split('=');
    return [[k, v ?? 'true']];
  }),
);

const limit = Number(args.get('limit') ?? 200);
const offset = Number(args.get('offset') ?? 0);
const concurrency = Math.min(Number(args.get('concurrency') ?? 10), 12);

const RFLR_API_BASE_URL = 'https://v3.dex.enosys.global/api/flr/v2/stats/rflr';
const RFLR_PRICE_USD = 0.016; // rFLR ≈ $0.016 (update via price API later)
const VESTING_PERIOD_MONTHS = 12; // 12 maanden lineair vesting
const EARLY_CLAIM_PENALTY = 0.5; // 50% boete op niet-gevestigd deel

// Token price service (lazy loaded)
let tokenPriceModule: any = null;
async function getTokenPriceModule() {
  if (!tokenPriceModule) {
    tokenPriceModule = await import('../src/services/tokenPriceService.js');
  }
  return tokenPriceModule;
}

// Concurrency limiter
function pLimit(n: number) {
  const queue: Array<() => void> = [];
  let activeCount = 0;
  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      const fn = queue.shift();
      if (fn) fn();
    }
  };
  return function <T>(fn: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        activeCount++;
        fn()
          .then((value) => {
            resolve(value);
            next();
          })
          .catch((error) => {
            reject(error);
            next();
          });
      };
      if (activeCount < n) run();
      else queue.push(run);
    });
  };
}

/**
 * Fetch rFLR reward for a single position via Enosys API
 */
async function getRflrReward(tokenId: string): Promise<number | null> {
  try {
    const response = await fetch(`${RFLR_API_BASE_URL}/${tokenId}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const reward = await response.json();
    const numericReward = typeof reward === 'number' ? reward : Number(reward);

    return Number.isFinite(numericReward) && numericReward > 0 ? numericReward : null;
  } catch (error) {
    return null;
  }
}

/**
 * Calculate vested rFLR amount
 * 
 * @param totalRflr Total rFLR rewards
 * @param startDate When vesting started (position creation or first reward)
 * @returns Vested amount (linearly over 12 months)
 */
function calculateVestedRflr(totalRflr: number, startDate: Date): number {
  const now = new Date();
  const monthsElapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const vestingProgress = Math.min(monthsElapsed / VESTING_PERIOD_MONTHS, 1);
  return totalRflr * vestingProgress;
}

/**
 * Calculate claimable rFLR (vested + early claim with penalty)
 * 
 * @param totalRflr Total rFLR rewards
 * @param vestedRflr Already vested amount
 * @returns Claimable amount if claiming early (with penalty)
 */
function calculateClaimableRflr(totalRflr: number, vestedRflr: number): number {
  const unvestedRflr = totalRflr - vestedRflr;
  const earlyClaimPenalty = unvestedRflr * EARLY_CLAIM_PENALTY;
  const claimableEarly = vestedRflr + (unvestedRflr - earlyClaimPenalty);
  return claimableEarly;
}

async function enrichRflrVesting() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💰 rFLR Vesting Calculation Enrichment');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const ENOSYS_NFPM = '0xd9770b1c7a6ccd33c75b5bcb1c0078f46be46657'.toLowerCase();

  // Get Enosys positions with creation date
  const positions = await prisma.$queryRaw<Array<{
    tokenId: string;
    pool: string;
    createdAt: Date;
  }>>`
    SELECT DISTINCT
      pt."tokenId",
      pe."pool",
      MIN(pe."timestamp") as "createdAt"
    FROM "PositionTransfer" pt
    JOIN "PositionEvent" pe ON pe."tokenId" = pt."tokenId"
    WHERE pt."nfpmAddress" = ${ENOSYS_NFPM}
      AND pe."pool" != 'unknown'
      AND pe."pool" IS NOT NULL
    GROUP BY pt."tokenId", pe."pool"
    ORDER BY pt."tokenId"
    LIMIT ${limit}
    OFFSET ${offset};
  `;

  console.log(`📊 Found ${positions.length} Enosys positions to calculate rFLR vesting for`);
  console.log(`🔄 Processing with concurrency=${concurrency}...\n`);

  const limitFn = pLimit(concurrency);
  let processed = 0;
  let updated = 0;
  let failed = 0;
  let totalRflr = 0;
  let totalVestedRflr = 0;
  let totalClaimableRflr = 0;
  const module = await getTokenPriceModule();

  // Get current rFLR price
  const rflrPrice = await module.getTokenPriceWithFallback('rFLR', RFLR_PRICE_USD);

  await Promise.all(
    positions.map((pos) =>
      limitFn(async () => {
        try {
          // Fetch rFLR reward from API
          const totalRflrReward = await getRflrReward(pos.tokenId);
          
          if (!totalRflrReward || totalRflrReward === 0) {
            processed++;
            return;
          }

          // Calculate vested amount (linearly over 12 months)
          const vestedRflr = calculateVestedRflr(totalRflrReward, pos.createdAt);
          
          // Calculate claimable amount (if claiming early with penalty)
          const claimableRflr = calculateClaimableRflr(totalRflrReward, vestedRflr);
          
          // Calculate USD values
          const totalRflrUsd = totalRflrReward * rflrPrice.price;
          const vestedRflrUsd = vestedRflr * rflrPrice.price;
          const claimableRflrUsd = claimableRflr * rflrPrice.price;
          
          // Calculate vesting progress
          const vestingProgress = totalRflrReward > 0 ? (vestedRflr / totalRflrReward) * 100 : 0;

          // Update PositionEvent metadata
          await prisma.$executeRaw`
            UPDATE "PositionEvent"
            SET "metadata" = COALESCE("metadata", '{}'::jsonb) || 
              jsonb_build_object(
                'rflrRewards', jsonb_build_object(
                  'totalRflr', ${totalRflrReward},
                  'vestedRflr', ${vestedRflr},
                  'claimableRflr', ${claimableRflr},
                  'totalRflrUsd', ${totalRflrUsd},
                  'vestedRflrUsd', ${vestedRflrUsd},
                  'claimableRflrUsd', ${claimableRflrUsd},
                  'vestingProgress', ${vestingProgress},
                  'vestingStartDate', ${pos.createdAt.toISOString()},
                  'vestingPeriodMonths', ${VESTING_PERIOD_MONTHS},
                  'earlyClaimPenalty', ${EARLY_CLAIM_PENALTY},
                  'lastUpdated', ${new Date().toISOString()}
                )
              )
            WHERE "tokenId" = ${pos.tokenId}
            LIMIT 1;
          `;

          totalRflr += totalRflrReward;
          totalVestedRflr += vestedRflr;
          totalClaimableRflr += claimableRflr;
          updated++;
          processed++;
          
          if (processed % 50 === 0) {
            console.log(`  Progress: ${processed}/${positions.length} (updated=${updated}, failed=${failed})`);
          }
        } catch (error) {
          failed++;
          processed++;
          if (processed % 50 === 0) {
            console.warn(`⚠️  Failed tokenId ${pos.tokenId}:`, error instanceof Error ? error.message : String(error));
          }
        }
      }),
    ),
  );

  const totalRflrUsd = totalRflr * rflrPrice.price;
  const totalVestedRflrUsd = totalVestedRflr * rflrPrice.price;
  const totalClaimableRflrUsd = totalClaimableRflr * rflrPrice.price;

  console.log(`\n✅ rFLR Vesting Calculation Complete:`);
  console.log(`   - Processed: ${processed}`);
  console.log(`   - Updated: ${updated}`);
  console.log(`   - Failed: ${failed}`);
  console.log(`   - Total rFLR: ${totalRflr.toFixed(2)} ($${totalRflrUsd.toFixed(2)})`);
  console.log(`   - Vested rFLR: ${totalVestedRflr.toFixed(2)} ($${totalVestedRflrUsd.toFixed(2)})`);
  console.log(`   - Claimable rFLR: ${totalClaimableRflr.toFixed(2)} ($${totalClaimableRflrUsd.toFixed(2)})\n`);

  return { processed, updated, failed, totalRflr, totalVestedRflr, totalClaimableRflr, totalRflrUsd, totalVestedRflrUsd, totalClaimableRflrUsd };
}

async function main() {
  console.log('🚀 rFLR Vesting Calculation Enrichment Script');
  console.log(`📅 Started: ${new Date().toISOString()}\n`);
  console.log(`⚙️  Configuration:`);
  console.log(`   - Limit: ${limit}`);
  console.log(`   - Offset: ${offset}`);
  console.log(`   - Concurrency: ${concurrency}`);
  console.log(`   - Vesting Period: ${VESTING_PERIOD_MONTHS} months`);
  console.log(`   - Early Claim Penalty: ${EARLY_CLAIM_PENALTY * 100}%\n`);

  const startTime = Date.now();
  const results = await enrichRflrVesting();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ENRICHMENT SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`⏱️  Total time: ${elapsed}s\n`);
  console.log(`💰 rFLR Vesting:`);
  console.log(`   ✅ Updated: ${results.updated}`);
  console.log(`   💎 Total rFLR: ${results.totalRflr.toFixed(2)} ($${results.totalRflrUsd.toFixed(2)})`);
  console.log(`   ✅ Vested rFLR: ${results.totalVestedRflr.toFixed(2)} ($${results.totalVestedRflrUsd.toFixed(2)})`);
  console.log(`   💰 Claimable rFLR: ${results.totalClaimableRflr.toFixed(2)} ($${results.totalClaimableRflrUsd.toFixed(2)})`);
  console.log(`   ❌ Failed: ${results.failed}\n`);

  console.log('✅ Enrichment complete!\n');

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });

