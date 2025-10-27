-- Add invoice metadata columns to payments
ALTER TABLE "Payment"
  ADD COLUMN "invoiceNumber" TEXT,
  ADD COLUMN "invoiceIssuedAt" TIMESTAMP(3),
  ADD COLUMN "invoiceCsv" TEXT,
  ADD COLUMN "invoiceSentAt" TIMESTAMP(3);
