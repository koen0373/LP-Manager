import { PositionEventType } from '@prisma/client';
import { bulkUpsertPositionEvents as savePositionEvents, getPositionEvents } from '@/lib/data/positionEvents';
import { bulkUpsertPositionTransfers as savePositionTransfers, getPositionTransfers } from '@/lib/data/positionTransfers';
import {
  getPositionManagerEvents,
  getPositionNftTransfers,
  PositionManagerEvent,
} from './flarescanService';
import { fetchLatestBlockNumber } from '@/lib/adapters/rpcLogs';
import { publicClient } from '@/lib/viemClient';

export interface SyncLedgerOptions {
  tokenId: string;
  poolAddress: string;
  fromBlock?: number;
  toBlock?: number;
  refresh?: boolean;
  seedTransfers?: Awaited<ReturnType<typeof getPositionNftTransfers>>;
}

type PositionLedgerResult = {
  events: Awaited<ReturnType<typeof getPositionEvents>>;
  transfers: Awaited<ReturnType<typeof getPositionTransfers>>;
};

const blockTimestampCache = new Map<number, number>();

async function resolveBlockTimestamp(blockNumber: number): Promise<number> {
  if (blockTimestampCache.has(blockNumber)) {
    return blockTimestampCache.get(blockNumber)!;
  }
  const block = await publicClient.getBlock({ blockNumber: BigInt(blockNumber) });
  const ts = Number(block.timestamp);
  blockTimestampCache.set(blockNumber, ts);
  return ts;
}

function mapEventType(event: PositionManagerEvent): PositionEventType {
  switch (event.type) {
    case 'increase':
      return PositionEventType.INCREASE;
    case 'decrease':
      return PositionEventType.DECREASE;
    case 'collect':
      return PositionEventType.COLLECT;
    default:
      return PositionEventType.OTHER;
  }
}

export async function syncPositionLedger({
  tokenId,
  poolAddress,
  fromBlock,
  toBlock,
  refresh,
  seedTransfers,
}: SyncLedgerOptions): Promise<PositionLedgerResult> {
  const latestBlock = toBlock ?? (await fetchLatestBlockNumber());
  const from = fromBlock ?? 0;

  const transfers =
    seedTransfers ??
    (await getPositionNftTransfers('0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657', tokenId, { refresh }));

  const managerEvents = await getPositionManagerEvents(tokenId, from, latestBlock, { refresh });

  const eventsPayload = await Promise.all(
    managerEvents.map(async (event) => ({
      id: `${event.txHash}:${event.logIndex}`,
      tokenId,
      pool: poolAddress.toLowerCase(),
      blockNumber: event.blockNumber,
      txHash: event.txHash,
      logIndex: event.logIndex,
      timestamp: event.timestamp ?? (await resolveBlockTimestamp(event.blockNumber)),
      eventType: mapEventType(event),
      sender: undefined,
      owner: undefined,
      recipient: event.recipient?.toLowerCase?.(),
      tickLower: undefined,
      tickUpper: undefined,
      tick: undefined,
      liquidityDelta: event.liquidity?.toString(),
      amount0: event.amount0?.toString(),
      amount1: event.amount1?.toString(),
      sqrtPriceX96: undefined,
      price1Per0: undefined,
      usdValue: undefined,
      metadata: undefined,
    }))
  );

  await savePositionEvents(eventsPayload);

  const transfersPayload = await Promise.all(
    transfers.map(async (transfer, index) => ({
      id: `${transfer.txHash}:${index}`,
      tokenId,
      from: transfer.from.toLowerCase(),
      to: transfer.to.toLowerCase(),
      blockNumber: transfer.blockNumber,
      txHash: transfer.txHash,
      logIndex: index,
      timestamp: transfer.timestamp ?? (await resolveBlockTimestamp(transfer.blockNumber)),
      metadata: undefined,
    }))
  );

  await savePositionTransfers(transfersPayload);

  const [events, storedTransfers] = await Promise.all([
    getPositionEvents(tokenId),
    getPositionTransfers(tokenId),
  ]);

  return {
    events,
    transfers: storedTransfers,
  };
}
