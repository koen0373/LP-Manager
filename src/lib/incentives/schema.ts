import { z } from 'zod';
import { getAddress } from 'viem';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const amountString = z
  .union([z.number(), z.string()])
  .transform((value) => (typeof value === 'number' ? value.toString() : value))
  .refine((value) => {
    if (!value) return false;
    const num = Number(value);
    return Number.isFinite(num) && num >= 0;
  }, 'Amount must be a non-negative number');

const IncentiveTokenSchema = z.object({
  symbol: z.string().regex(/^[A-Z0-9_]{1,10}$/),
  amountPerDay: amountString,
  tokenAddress: z
    .string()
    .regex(ADDRESS_REGEX)
    .transform((address) => address.toLowerCase())
    .optional(),
  decimals: z.number().int().min(0).max(36).optional(),
});

const IncentiveRecordSchema = z.object({
  pool: z
    .string()
    .regex(ADDRESS_REGEX)
    .transform((address) => address.toLowerCase()),
  provider: z.enum(['enosys', 'sparkdex']),
  usdPerDay: amountString,
  tokens: z.array(IncentiveTokenSchema).min(1),
  updatedAt: z
    .string()
    .datetime()
    .or(z.date().transform((d) => d.toISOString()))
    .transform((value) => new Date(value).toISOString()),
});

export const IncentiveRecordsSchema = z.array(IncentiveRecordSchema);

export type IncentiveRecord = z.infer<typeof IncentiveRecordSchema>;

export function checksumOrFallback(address: string) {
  try {
    return getAddress(address);
  } catch (error) {
    return address;
  }
}

export function parseIncentiveRecords(input: unknown): IncentiveRecord[] {
  const result = IncentiveRecordsSchema.safeParse(input);
  if (!result.success) {
    return [];
  }
  return result.data;
}
