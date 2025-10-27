import { Hex } from 'viem';

import { publicClient } from '@/lib/viemClient';

const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

function topicAddress(topic: string): string {
  return normalizeAddress(`0x${topic.slice(-40)}`);
}

function decimalToBigInt(amount: string, decimals: number): bigint {
  const [wholeRaw, fractionalRaw = ''] = amount.split('.');
  const whole = wholeRaw.replace(/[^0-9]/g, '') || '0';
  const fractional = (fractionalRaw.replace(/[^0-9]/g, '') + '0'.repeat(decimals)).slice(0, decimals);
  const combined = `${whole}${fractional}`.replace(/^0+/, '') || '0';
  return BigInt(combined);
}

export interface VerifyCryptoPaymentInput {
  txHash: string;
  tokenAddress: string;
  fromAddress: string;
  toAddress: string;
  amountToken: string;
  decimals?: number;
}

export interface VerifyCryptoPaymentResult {
  blockNumber: bigint;
  transactionHash: Hex;
}

export async function verifyErc20Payment(
  params: VerifyCryptoPaymentInput,
): Promise<VerifyCryptoPaymentResult> {
  const {
    txHash,
    tokenAddress,
    fromAddress,
    toAddress,
    amountToken,
    decimals = 6,
  } = params;

  if (!txHash) {
    throw new Error('Transaction hash is required');
  }

  const normalizedToken = normalizeAddress(tokenAddress);
  const normalizedFrom = normalizeAddress(fromAddress);
  const normalizedTo = normalizeAddress(toAddress);
  const expectedAmount = decimalToBigInt(amountToken, decimals);

  const receipt = await publicClient.getTransactionReceipt({ hash: txHash as Hex });

  if (receipt.status !== 'success') {
    throw new Error('Transaction not successful on-chain');
  }

  const matchingLog = receipt.logs.find((log) => {
    if (normalizeAddress(log.address) !== normalizedToken) {
      return false;
    }

    if (!log.topics || log.topics.length < 3) {
      return false;
    }

    if (log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) {
      return false;
    }

    const fromTopic = log.topics[1] ? topicAddress(log.topics[1]) : '';
    const toTopic = log.topics[2] ? topicAddress(log.topics[2]) : '';

    if (fromTopic !== normalizedFrom || toTopic !== normalizedTo) {
      return false;
    }

    try {
      const value = BigInt(log.data);
      return value === expectedAmount;
    } catch {
      return false;
    }
  });

  if (!matchingLog) {
    throw new Error('No matching ERC-20 transfer found for payment');
  }

  return {
    blockNumber: receipt.blockNumber,
    transactionHash: receipt.transactionHash,
  };
}
