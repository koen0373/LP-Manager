import type { PrismaClient, User } from '@prisma/client';

import { addThirtyDays } from '@/server/services/billing';
import { prisma } from '@/server/db';

const DEFAULT_LIMIT = 100;

// Type for Prisma transaction client
type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

export function getEarlyAccessLimit(): number {
  const fromEnv = Number(process.env.EARLY_ACCESS_LIMIT ?? DEFAULT_LIMIT);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? Math.floor(fromEnv) : DEFAULT_LIMIT;
}

export async function getEarlyAccessStats(client?: PrismaClient | PrismaTransaction) {
  const db = client ?? prisma;
  const limit = getEarlyAccessLimit();
  const activated = await db.user.count({ where: { state: 'ACTIVATED' } });
  return {
    limit,
    activated,
    remaining: Math.max(0, limit - activated),
  };
}

export async function canActivateAnotherUser(client?: PrismaClient | PrismaTransaction) {
  const { remaining } = await getEarlyAccessStats(client);
  return remaining > 0;
}

type UserContext = {
  email?: string;
  wallet?: string;
};

function normalizeEmail(email?: string | null) {
  return email ? email.trim().toLowerCase() : undefined;
}

function normalizeAddress(address?: string | null) {
  return address ? address.trim().toLowerCase() : undefined;
}

export async function ensureUserRecord(
  input: UserContext,
  client?: PrismaClient | PrismaTransaction,
): Promise<{ user: User; walletId?: number | null }> {
  const db = client ?? prisma;
  const email = normalizeEmail(input.email);
  const walletAddress = normalizeAddress(input.wallet);

  let user: User | null = null;

  if (email) {
    user = await db.user.findUnique({ where: { email } });
  }

  if (!user && walletAddress) {
    const wallet = await db.wallet.findFirst({ where: { address: walletAddress } });
    if (wallet) {
      user = await db.user.findUnique({ where: { id: wallet.userId } });
    }
  }

  if (!user) {
    user = await db.user.create({
      data: {
        email,
      },
    });
  } else if (email && !user.email) {
    user = await db.user.update({ where: { id: user.id }, data: { email } });
  }

  // At this point user is guaranteed to be non-null
  const userId = user.id;
  let walletId: number | null = null;

  if (walletAddress) {
    const now = new Date();
    const existingWallet = await db.wallet.findFirst({
      where: { userId, address: walletAddress },
    });

    if (existingWallet) {
      walletId = existingWallet.id;
    } else {
      const wallet = await db.wallet.create({
        data: {
          userId,
          address: walletAddress,
          billingStartedAt: now,
          billingExpiresAt: addThirtyDays(now),
        },
      });
      walletId = wallet.id;
    }
  }

  return { user, walletId };
}

export async function activateUserAccount(
  userId: string,
  client?: PrismaClient,
) {
  const db = client ?? prisma;

  return db.$transaction(async (tx) => {
    const { remaining } = await getEarlyAccessStats(tx as PrismaTransaction);
    if (remaining <= 0) {
      throw new Error('Early access limit reached');
    }

    return tx.user.update({
      where: { id: userId },
      data: {
        state: 'ACTIVATED',
        poolAllowance: 2,
        activatedAt: new Date(),
      },
    });
  });
}
