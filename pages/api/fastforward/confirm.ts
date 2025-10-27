import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '@/server/db';
import { ensureUserRecord } from '@/server/services/access';
import { verifyErc20Payment } from '@/server/services/cryptoPayments';

const AMOUNT_TOKEN_DECIMALS = 6;

function normalize(value?: string) {
  return value?.trim().toLowerCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
    const { intentId, txHash, fromWallet } = body as {
      intentId?: unknown;
      txHash?: unknown;
      fromWallet?: unknown;
    };

    if (typeof intentId !== 'string' || !intentId) {
      return res.status(400).json({ error: 'intentId is required' });
    }

    if (typeof txHash !== 'string' || !txHash) {
      return res.status(400).json({ error: 'txHash is required' });
    }

    const normalizedFrom = typeof fromWallet === 'string' ? normalize(fromWallet) : undefined;

    const payment = await prisma.payment.findUnique({ where: { intentId } });

    if (!payment) {
      return res.status(404).json({ error: 'Payment intent not found' });
    }

    if (payment.status === 'PAID') {
      return res.status(200).json({ status: payment.status, txHash: payment.txHash });
    }

    if (payment.expiresAt && payment.expiresAt < new Date()) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      return res.status(400).json({ error: 'Payment intent expired' });
    }

    if (!normalizedFrom && !payment.payerAddress) {
      return res.status(400).json({ error: 'fromWallet is required' });
    }

    const fromAddress = normalizedFrom ?? payment.payerAddress!;

    await verifyErc20Payment({
      txHash,
      tokenAddress: payment.tokenAddress,
      fromAddress,
      toAddress: payment.treasuryAddress,
      amountToken: payment.amountToken.toString(),
      decimals: AMOUNT_TOKEN_DECIMALS,
    });

    if (fromAddress) {
      await ensureUserRecord({ wallet: fromAddress }, prisma);
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        txHash,
        payerAddress: fromAddress,
      },
    });

    return res.status(200).json({ status: 'PAID', txHash });
  } catch (error) {
    console.error('[FASTFORWARD_CONFIRM] Failed', error);
    const message = error instanceof Error ? error.message : 'Failed to confirm payment';
    return res.status(500).json({ error: message });
  }
}
