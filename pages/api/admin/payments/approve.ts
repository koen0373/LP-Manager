import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '@/server/db';
import { activateUserAccount } from '@/server/services/access';
import { sendFasttrackApprovalEmail } from '@/server/email/sendFasttrackApprovalEmail';
import { buildInvoiceDetails } from '@/server/services/invoice';

function authorize(req: NextApiRequest, res: NextApiResponse): string | null {
  const expectedSecret = process.env.ADMIN_SECRET;
  const provided = req.headers['x-admin-secret'] ?? req.body?.secret;

  if (!expectedSecret || expectedSecret === 'change-me') {
    res.status(500).json({ error: 'ADMIN_SECRET not configured' });
    return null;
  }

  if (typeof provided !== 'string' || provided !== expectedSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const actorHeader = req.headers['x-admin-actor'];
  return typeof actorHeader === 'string' ? actorHeader : 'admin';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const approvedBy = authorize(req, res);
  if (!approvedBy) {
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
    const { paymentId } = body as { paymentId?: unknown };

    if (typeof paymentId !== 'number') {
      return res.status(400).json({ error: 'paymentId must be a number' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'PAID') {
      return res.status(400).json({ error: 'Payment must be marked as PAID before approval' });
    }

    const user = await activateUserAccount(payment.userId, prisma);

    const userRecord = await prisma.user.findUnique({
      where: { id: payment.userId },
      select: {
        email: true,
        wallets: {
          select: { address: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const walletAddress = userRecord?.wallets?.[0]?.address ?? payment.payerAddress ?? null;

    const invoiceDetails = buildInvoiceDetails(payment, {
      email: userRecord?.email ?? user.email ?? null,
      walletAddress,
      txHash: payment.txHash ?? null,
    });

    const approvedAt = new Date();

    let updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        approvedBy,
        approvedAt,
        invoiceNumber: invoiceDetails.invoiceNumber,
        invoiceIssuedAt: invoiceDetails.invoiceIssuedAt,
        invoiceCsv: invoiceDetails.invoiceCsv,
      },
    });

    const emailSent = await sendFasttrackApprovalEmail({
      to: userRecord?.email ?? user.email ?? null,
      wallet: walletAddress,
      invoice: {
        invoiceNumber: invoiceDetails.invoiceNumber,
        invoiceCsv: invoiceDetails.invoiceCsv,
        issuedAt: invoiceDetails.invoiceIssuedAt,
        totalUsd: invoiceDetails.totalUsd,
      },
    });

    if (emailSent) {
      updatedPayment = await prisma.payment.update({
        where: { id: paymentId },
        data: { invoiceSentAt: new Date() },
      });
    }

    return res.status(200).json({
      success: true,
      invoiceEmailSent: emailSent,
      payment: {
        id: updatedPayment.id,
        status: updatedPayment.status,
        approvedAt: updatedPayment.approvedAt?.toISOString() ?? null,
        invoiceNumber: updatedPayment.invoiceNumber ?? null,
        invoiceIssuedAt: updatedPayment.invoiceIssuedAt?.toISOString() ?? null,
        invoiceSentAt: updatedPayment.invoiceSentAt?.toISOString() ?? null,
      },
      user: {
        id: user.id,
        state: user.state,
        poolAllowance: user.poolAllowance,
        activatedAt: user.activatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error('[ADMIN_PAYMENT_APPROVE] Failed', error);
    const message = error instanceof Error ? error.message : 'Failed to approve payment';
    return res.status(500).json({ error: message });
  }
}
