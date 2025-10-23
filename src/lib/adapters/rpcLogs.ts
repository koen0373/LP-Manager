import { z } from 'zod';
import { rateLimitedFetch, toHex } from './rateLimit';
import { ExplorerLog, dedupeLogs } from './logs';

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_URL || 'https://flare.flr.finance/ext/bc/C/rpc';

const rpcLogSchema = z.object({
  address: z.string(),
  data: z.string(),
  topics: z.array(z.string()),
  blockNumber: z.string(),
  transactionHash: z.string(),
  transactionIndex: z.string(),
  logIndex: z.string(),
});

const rpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.number(),
  result: z.array(rpcLogSchema).optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
    })
    .optional(),
});

const fromHex = (value: string): number => Number.parseInt(value, 16);
const blockNumberResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.number(),
  result: z.string().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
    })
    .optional(),
});

export interface RpcLogsParams {
  address: string;
  fromBlock: number;
  toBlock: number;
  topics?: string[];
  chunkSize?: number;
}

export async function fetchLogsViaRpc(params: RpcLogsParams): Promise<ExplorerLog[]> {
  const { address, fromBlock, toBlock, topics = [], chunkSize = 3000 } = params;
  const collected: ExplorerLog[] = [];

  for (let start = fromBlock; start <= toBlock; start += chunkSize + 1) {
    const end = Math.min(start + chunkSize, toBlock);
    const description = `RPC logs ${address} blocks ${start}-${end}`;

    const response = await rateLimitedFetch({
      description,
      request: () =>
        fetch(RPC_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getLogs',
            params: [
              {
                address,
                fromBlock: toHex(start),
                toBlock: toHex(end),
                topics,
              },
            ],
          }),
        }),
    });

    if (!response.ok) {
      throw new Error(`[RPC] ${description} failed with status ${response.status}`);
    }

    const payload = rpcResponseSchema.parse(await response.json());
    if (payload.error) {
      throw new Error(`[RPC] ${description} failed: ${payload.error.message}`);
    }

    for (const log of payload.result ?? []) {
      collected.push({
        address: log.address,
        data: log.data,
        topics: log.topics,
        transactionHash: log.transactionHash,
        transactionIndex: fromHex(log.transactionIndex),
        logIndex: fromHex(log.logIndex),
        blockNumber: fromHex(log.blockNumber),
      });
    }
  }

  return dedupeLogs(collected);
}

export async function fetchLatestBlockNumber(): Promise<number> {
  const response = await rateLimitedFetch({
    description: 'eth_blockNumber',
    request: () =>
      fetch(RPC_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_blockNumber',
          params: [],
        }),
      }),
  });

  if (!response.ok) {
    throw new Error(`[RPC] eth_blockNumber failed with status ${response.status}`);
  }

  const payload = blockNumberResponseSchema.parse(await response.json());
  if (payload.error || !payload.result) {
    throw new Error(`[RPC] eth_blockNumber failed: ${payload.error?.message ?? 'No result'}`);
  }

  return fromHex(payload.result);
}
