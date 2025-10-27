import type { Payment } from '@prisma/client';

interface InvoiceContext {
  email?: string | null;
  walletAddress?: string | null;
  txHash?: string | null;
}

export interface InvoiceDetails {
  invoiceNumber: string;
  invoiceIssuedAt: Date;
  invoiceCsv: string;
  totalUsd: number;
}

const BASE_DESCRIPTION = 'LiquiLab Fast-Track Early Access';

const toDateSegment = (value: Date) => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const toIsoDate = (value: Date) => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const sanitize = (input: string | null | undefined) => {
  if (!input) return '';
  return input.replace(/[\n\r]+/g, ' ').trim();
};

const sanitizeDescription = (description: string) => description.replace(/,/g, ';');

export function buildInvoiceDetails(payment: Payment, context: InvoiceContext = {}): InvoiceDetails {
  const issuedAt = payment.invoiceIssuedAt ?? new Date();
  const invoiceNumber = payment.invoiceNumber ?? `LL-${toDateSegment(issuedAt)}-${payment.id}`;

  const customerEmail = sanitize(context.email ?? null);
  const walletAddress = sanitize(context.walletAddress ?? payment.payerAddress ?? null);
  const txHash = sanitize(context.txHash ?? payment.txHash ?? null);

  const totalUsd = Number(payment.amountUsd.toFixed(2));
  const unitPrice = totalUsd.toFixed(2);
  const subtotal = unitPrice;
  const tax = '0.00';
  const total = unitPrice;

  const description = walletAddress
    ? `${BASE_DESCRIPTION} (wallet: ${walletAddress})`
    : BASE_DESCRIPTION;

  const csvHeader = [
    'InvoiceNumber',
    'IssueDate',
    'CustomerEmail',
    'Description',
    'Quantity',
    'UnitPrice',
    'Currency',
    'Subtotal',
    'Tax',
    'Total',
    'Wallet',
    'TxHash',
    'TokenAddress',
    'ChainId',
  ];

  const csvRow = [
    invoiceNumber,
    toIsoDate(issuedAt),
    customerEmail,
    sanitizeDescription(description),
    '1',
    unitPrice,
    'USD',
    subtotal,
    tax,
    total,
    walletAddress,
    txHash,
    payment.tokenAddress,
    String(payment.chainId),
  ];

  const invoiceCsv = `${csvHeader.join(',')}\n${csvRow.join(',')}\n`;

  return {
    invoiceNumber,
    invoiceIssuedAt: issuedAt,
    invoiceCsv,
    totalUsd,
  };
}
