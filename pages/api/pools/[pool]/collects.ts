import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchLogsViaBlockscout } from '../../../../src/lib/adapters/blockscout';
import {
  fetchLatestBlockNumber,
  fetchLogsViaRpc,
} from '../../../../src/lib/adapters/rpcLogs';
import type { ExplorerLog } from '../../../../src/lib/adapters/logs';

const COLLECT_TOPIC =
  '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0';

type CollectsResponse =
  | { logs: ExplorerLog[]; source: 'blockscout' | 'rpc'; count: number }
  | { error: string };

function parseBlockParam(value: string | string[] | undefined): number | 'latest' | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'latest') return 'latest';
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid block parameter: ${raw}`);
  }
  return parsed;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CollectsResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const poolAddressParam = Array.isArray(req.query.pool) ? req.query.pool[0] : req.query.pool;
  if (!poolAddressParam || typeof poolAddressParam !== 'string') {
    res.status(400).json({ error: 'Missing pool address in request path' });
    return;
  }

  const poolAddress = poolAddressParam.toLowerCase();

  try {
    const fromBlockParam = parseBlockParam(req.query.fromBlock);
    const toBlockParam = parseBlockParam(req.query.toBlock);

    let toBlock: number;
    if (toBlockParam === 'latest' || toBlockParam === undefined) {
      toBlock = await fetchLatestBlockNumber();
    } else {
      toBlock = toBlockParam;
    }

    const fromBlock =
      fromBlockParam === undefined || fromBlockParam === 'latest' ? 0 : fromBlockParam;

    let logs: ExplorerLog[] = [];
    let source: 'blockscout' | 'rpc' = 'blockscout';

    try {
      logs = await fetchLogsViaBlockscout({
        address: poolAddress,
        fromBlock,
        toBlock,
        topics: [COLLECT_TOPIC],
      });
    } catch (error) {
      console.warn('[Collects API] Blockscout fetch failed, falling back to RPC', error);
    }

    if (logs.length === 0) {
      logs = await fetchLogsViaRpc({
        address: poolAddress,
        fromBlock,
        toBlock,
        topics: [COLLECT_TOPIC],
      });
      source = 'rpc';
    }

    res.status(200).json({ logs, source, count: logs.length });
  } catch (error) {
    console.error('[Collects API] Failed to fetch logs', error);
    res.status(500).json({ error: (error as Error).message });
  }
}

