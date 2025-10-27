import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '@/server/db';
import { ensureUserRecord } from '@/server/services/access';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
    const { address, email } = body as { address?: unknown; email?: unknown };

    if (typeof address !== 'string' || !address.trim()) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    const normalizedAddress = address.trim().toLowerCase();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : undefined;

    const { user } = await ensureUserRecord({ email: normalizedEmail, wallet: normalizedAddress }, prisma);

    const wallet = await prisma.wallet.findFirstOrThrow({
      where: { userId: user.id, address: normalizedAddress },
    });

    return res.status(200).json({
      id: wallet.id,
      address: wallet.address,
      billingStartedAt: wallet.billingStartedAt.toISOString(),
      billingExpiresAt: wallet.billingExpiresAt.toISOString(),
      userId: user.id,
      state: user.state,
    });
  } catch (error) {
    console.error('[WALLET_ADD] Failed to add wallet', error);
    return res.status(500).json({ error: 'Failed to add wallet' });
  }
}
