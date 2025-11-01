import { getAddress } from 'viem';

/**
 * Convert an Ethereum address to checksummed format.
 * Returns the input as-is if invalid.
 */
export function toChecksummed(address: string): string {
  try {
    return getAddress(address);
  } catch {
    return address;
  }
}

