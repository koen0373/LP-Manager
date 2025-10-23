import { z } from 'zod';
import { rateLimitedFetch } from './rateLimit';
import { ExplorerLog, dedupeLogs } from './logs';

const BLOCKSCOUT_LOGS_ENDPOINT = 'https://flare-explorer.flare.network/api/v2/logs';

const blockscoutLogSchema = z.object({
  address: z.string(),
  data: z.string(),
  topics: z.array(z.string()),
  transaction_hash: z.string(),
  transaction_index: z.union([z.number(), z.string()]),
  log_index: z.union([z.number(), z.string()]),
  block_number: z.union([z.number(), z.string()]),
  timestamp: z.string().optional(),
});

const blockscoutResponseSchema = z.object({
  items: z.array(blockscoutLogSchema),
});

export interface BlockscoutLogsParams {
  address: string;
  fromBlock: number;
  toBlock: number;
  topics?: string[];
  chunkSize?: number;
}

const toNumber = (value: string | number): number => {
  if (typeof value === 'number') return value;
  if (value.startsWith('0x')) {
    return Number.parseInt(value.slice(2), 16);
  }
  return Number.parseInt(value, 10);
};

export async function fetchLogsViaBlockscout(params: BlockscoutLogsParams): Promise<ExplorerLog[]> {
  const { address, fromBlock, toBlock, topics = [], chunkSize = 3000 } = params;
  const collected: ExplorerLog[] = [];

  for (let start = fromBlock; start <= toBlock; start += chunkSize + 1) {
    const end = Math.min(start + chunkSize, toBlock);
    const description = `Blockscout logs ${address} blocks ${start}-${end}`;

    const response = await rateLimitedFetch({
      description,
      request: () =>
        fetch(BLOCKSCOUT_LOGS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            fromBlock: start,
            toBlock: end,
            topics,
          }),
        }),
    });

    if (!response.ok) {
      throw new Error(`[Blockscout] ${description} failed with status ${response.status}`);
    }

    const parsed = blockscoutResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      console.warn('[Blockscout] Unexpected response shape', parsed.error.flatten());
      continue;
    }

    for (const item of parsed.data.items) {
      collected.push({
        address: item.address,
        data: item.data,
        topics: item.topics,
        transactionHash: item.transaction_hash,
        transactionIndex: toNumber(item.transaction_index),
        logIndex: toNumber(item.log_index),
        blockNumber: toNumber(item.block_number),
        timestamp: item.timestamp,
      });
    }
  }

  return dedupeLogs(collected);
}

