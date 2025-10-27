import type { NextApiRequest, NextApiResponse } from 'next';

import { db } from '@/lib/data/db';
import { PoolStatus } from '@prisma/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
    const { walletId, poolId, provider, active } = body as {
      walletId?: unknown;
      poolId?: unknown;
      provider?: unknown;
      active?: unknown;
    };

    if (typeof walletId !== 'number' || Number.isNaN(walletId)) {
      return res.status(400).json({ error: 'walletId must be a number' });
    }

    if (typeof poolId !== 'string' || !poolId.trim()) {
      return res.status(400).json({ error: 'poolId must be provided' });
    }

    const wallet = await db.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const normalizedPoolId = poolId.trim().toLowerCase();
    const inferredActive = typeof active === 'boolean' ? active : Boolean(active);
    const status = inferredActive ? PoolStatus.ACTIVE : PoolStatus.INACTIVE;
    const now = new Date();

    const userPool = await db.userPool.upsert({
      where: { walletId_poolId: { walletId, poolId: normalizedPoolId } },
      create: {
        walletId,
        poolId: normalizedPoolId,
        provider: typeof provider === 'string' && provider.trim() ? provider.trim() : 'unknown',
        status,
        excludedFromBilling: !inferredActive,
        lastActivity: now,
      },
      update: {
        status,
        excludedFromBilling: !inferredActive,
        provider: typeof provider === 'string' && provider.trim() ? provider.trim() : undefined,
        lastActivity: now,
      },
    });

    return res.status(200).json({
      id: userPool.id,
      walletId: userPool.walletId,
      poolId: userPool.poolId,
      provider: userPool.provider,
      status: userPool.status,
      excludedFromBilling: userPool.excludedFromBilling,
      lastActivity: userPool.lastActivity ? userPool.lastActivity.toISOString() : null,
    });
  } catch (error) {
    console.error('[POOL_TOGGLE] Failed to toggle pool', error);
    return res.status(500).json({ error: 'Failed to toggle pool' });
  }
}

