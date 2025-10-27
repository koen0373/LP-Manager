import type { PrismaClient } from '@prisma/client';
import { PoolStatus } from '@prisma/client';

export interface BillingBreakdown {
  activePools: number;
  addOnPools: number;
  unitPrice: number;
  discountPercent: number;
  addOnUnit: number;
  addOnDiscountPercent: number;
  poolsCost: number;
  addOnCost: number;
  total: number;
}

export function getTierDiscount(count: number): number {
  if (count <= 5) return 0;
  if (count <= 20) return 0.1;
  if (count <= 49) return 0.15;
  return 0.2;
}

export function getUnitPrice(activePools: number): number {
  const base = 2.0;
  return Number((base * (1 - getTierDiscount(activePools))).toFixed(2));
}

export function computeMonthlyCost(activePools: number, addOnPools: number): BillingBreakdown {
  const unitPrice = getUnitPrice(activePools);
  const addOnBase = 0.5 * unitPrice;
  const addOnDiscount = getTierDiscount(addOnPools);
  const addOnUnit = Number((addOnBase * (1 - addOnDiscount)).toFixed(2));

  const poolsCost = Number((unitPrice * activePools).toFixed(2));
  const addOnCost = Number((addOnUnit * addOnPools).toFixed(2));
  const total = Number((poolsCost + addOnCost).toFixed(2));

  return {
    activePools,
    addOnPools,
    unitPrice,
    discountPercent: getTierDiscount(activePools) * 100,
    addOnUnit,
    addOnDiscountPercent: addOnDiscount * 100,
    poolsCost,
    addOnCost,
    total,
  };
}

export async function monthlyCostForWallet(
  prisma: PrismaClient,
  walletId: number,
  addOnPools = 0,
): Promise<(BillingBreakdown & { expiresAt: Date | null }) | null> {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: { billingExpiresAt: true },
  });

  if (!wallet) {
    return null;
  }

  const activeCount = await prisma.userPool.count({
    where: {
      walletId,
      status: PoolStatus.ACTIVE,
      excludedFromBilling: false,
    },
  });

  return {
    ...computeMonthlyCost(activeCount, addOnPools),
    expiresAt: wallet.billingExpiresAt,
  };
}

export function addThirtyDays(base: Date = new Date()): Date {
  const result = new Date(base.getTime());
  result.setDate(result.getDate() + 30);
  return result;
}
