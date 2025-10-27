import { randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '@/server/db';
import { ensureUserRecord } from '@/server/services/access';

const AMOUNT_USD = '50.00';
const AMOUNT_TOKEN_VALUE = 50;
const AMOUNT_TOKEN_DISPLAY = '50.000000';

function getTreasuryAddress() {
  const address = process.env.TREASURY_ADDRESS;
  if (!address) {
    throw new Error('TREASURY_ADDRESS not configured');
  }
  return address.trim().toLowerCase();
}

function getAcceptedTokenAddress() {
  const address = process.env.ACCEPTED_TOKEN_ADDRESS_USDT0;
  if (!address) {
    throw new Error('ACCEPTED_TOKEN_ADDRESS_USDT0 not configured');
  }
  return address.trim().toLowerCase();
}

function getChainId() {
  const fromEnv = Number(process.env.CHAIN_ID ?? 14);
  return Number.isFinite(fromEnv) ? Math.floor(fromEnv) : 14;
}

function getExpiresAt() {
  const ttlMinutes = Number(process.env.PAYMENT_INTENT_TTL_MINUTES ?? 30);
  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) {
    return null;
  }
  return new Date(Date.now() + ttlMinutes * 60_000);
}

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

    const treasuryAddress = getTreasuryAddress();
    const tokenAddress = getAcceptedTokenAddress();
    const chainId = getChainId();
    const expiresAt = getExpiresAt();

    const { user } = await ensureUserRecord({ email: normalizedEmail, wallet: normalizedWallet }, prisma);

    const intentId = randomUUID();

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        provider: 'crypto',
        chainId,
        tokenAddress,
        treasuryAddress,
        amountUsd: Number(AMOUNT_USD),
        amountToken: AMOUNT_TOKEN_VALUE,
        intentId,
        expiresAt: expiresAt ?? undefined,
        disclaimerAccepted: true,
        payerAddress: normalizedWallet,
      },
    });

    if (normalizedEmail) {
      await prisma.waitlistEntry.upsert({
        where: { email: normalizedEmail },
        update: {
          wallet: normalizedWallet,
          fastTrack: true,
        },
        create: {
          email: normalizedEmail,
          wallet: normalizedWallet,
          fastTrack: true,
        },
      });
    }

    return res.status(201).json({
      intentId: payment.intentId,
      treasury: treasuryAddress,
      token: tokenAddress,
      amountToken: AMOUNT_TOKEN_DISPLAY,
      chainId,
      amountUsd: AMOUNT_USD,
      expiresAt: payment.expiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('[FASTFORWARD_CREATE_INTENT] Failed', error);
    const message = error instanceof Error ? error.message : 'Failed to create fast-forward intent';
    return res.status(500).json({ error: message });
  }
}
