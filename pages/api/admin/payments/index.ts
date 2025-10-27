import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '@/server/db';

function authorize(req: NextApiRequest, res: NextApiResponse): boolean {
  const expectedSecret = process.env.ADMIN_SECRET;
  const provided = req.headers['x-admin-secret'] ?? req.query.secret;

  if (!expectedSecret || expectedSecret === 'change-me') {
    res.status(500).json({ error: 'ADMIN_SECRET not configured' });
    return false;
  }

  if (typeof provided !== 'string' || provided !== expectedSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!authorize(req, res)) {
    return;
  }

  try {
    const payments = await prisma.payment.findMany({
      where: {
        status: {
          in: ['PENDING', 'PAID'],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            state: true,
            activatedAt: true,
          },
        },
      },
    });

    return res.status(200).json(
      payments.map((payment) => ({
        id: payment.id,
        userId: payment.userId,
        email: payment.user?.email ?? null,
        state: payment.user?.state ?? null,
        amountUsd: payment.amountUsd.toFixed(2),
        amountToken: payment.amountToken.toFixed(6),
        tokenAddress: payment.tokenAddress,
        treasuryAddress: payment.treasuryAddress,
        chainId: payment.chainId,
        intentId: payment.intentId,
        status: payment.status,
        txHash: payment.txHash,
        payerAddress: payment.payerAddress,
        disclaimerAccepted: payment.disclaimerAccepted,
        createdAt: payment.createdAt.toISOString(),
        expiresAt: payment.expiresAt?.toISOString() ?? null,
        approvedAt: payment.approvedAt?.toISOString() ?? null,
        invoiceNumber: payment.invoiceNumber ?? null,
        invoiceIssuedAt: payment.invoiceIssuedAt?.toISOString() ?? null,
        invoiceSentAt: payment.invoiceSentAt?.toISOString() ?? null,
        invoiceCsv: payment.invoiceCsv ?? null,
      })),
    );
  } catch (error) {
    console.error('[ADMIN_PAYMENTS_LIST] Failed', error);
    return res.status(500).json({ error: 'Failed to load payments' });
  }
}
