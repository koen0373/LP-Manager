import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '@/server/db';
import { ensureUserRecord, getEarlyAccessStats } from '@/server/services/access';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
    const { email, wallet } = body as { email?: unknown; wallet?: unknown };

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
    const normalizedWallet = typeof wallet === 'string' ? wallet.trim().toLowerCase() : undefined;

    if (!normalizedEmail && !normalizedWallet) {
      return res.status(400).json({ error: 'Email or wallet is required' });
    }

    const { user } = await ensureUserRecord({ email: normalizedEmail, wallet: normalizedWallet }, prisma);

    if (!normalizedEmail) {
      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          state: user.state,
          poolAllowance: user.poolAllowance,
        },
      });
    }

    const entry = await prisma.waitlistEntry.upsert({
      where: { email: normalizedEmail },
      update: {
        wallet: normalizedWallet,
      },
      create: {
        email: normalizedEmail,
        wallet: normalizedWallet,
      },
    });

    const stats = await getEarlyAccessStats(prisma);

    return res.status(201).json({
      success: true,
      waitlistId: entry.id,
      user: {
        id: user.id,
        state: user.state,
        poolAllowance: user.poolAllowance,
        activatedAt: user.activatedAt,
      },
      stats,
    });
  } catch (error) {
    console.error('[WAITLIST_JOIN] Failed', error);
    return res.status(500).json({ error: 'Failed to join waitlist' });
  }
}
