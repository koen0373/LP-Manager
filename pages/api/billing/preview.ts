import type { NextApiRequest, NextApiResponse } from 'next';

import { db } from '@/lib/data/db';
import { monthlyCostForWallet } from '@/server/services/billing';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { walletId, addOnPools } = req.query;

  const numericWalletId = Number(walletId);
  if (!walletId || Number.isNaN(numericWalletId)) {
    return res.status(400).json({ error: 'walletId query parameter is required' });
  }

  const parsedAddOnPools = addOnPools === undefined ? 0 : Number(addOnPools);
  if (Number.isNaN(parsedAddOnPools)) {
    return res.status(400).json({ error: 'addOnPools must be a number if provided' });
  }

  const normalizedAddOns = Math.max(0, Math.floor(parsedAddOnPools));

  try {
    const breakdown = await monthlyCostForWallet(db, numericWalletId, normalizedAddOns);

    if (!breakdown) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const { expiresAt, ...rest } = breakdown;

    return res.status(200).json({
      ...rest,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    });
  } catch (error) {
    console.error('[BILLING_PREVIEW] Failed to calculate billing preview', error);
    return res.status(500).json({ error: 'Failed to calculate billing preview' });
  }
}
