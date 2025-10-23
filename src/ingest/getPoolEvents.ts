import { Address } from 'viem';
import { chunkedLogs } from './chunkedLogs';
import { db } from '@/store/prisma';
import { decodePoolLog } from './decode';
import { flare } from '@/chains/flare';

export async function ingestPool(address: Address, fromBlock: bigint, toBlock: bigint) {
  console.log(`[INGEST] Starting ingestion for pool ${address} from block ${fromBlock} to ${toBlock}`);
  
  let totalEvents = 0;
  
  for await (const logs of chunkedLogs({ address, fromBlock, toBlock })) {
    for (const log of logs) {
      const parsed = decodePoolLog(log);
      if (!parsed) continue;

      const id = `${log.transactionHash}:${log.logIndex}`;
      
      try {
        await db.poolEvent.upsert({
          where: { id },
          update: {},
          create: {
            id,
            pool: address.toLowerCase(),
            blockNumber: Number(log.blockNumber),
            txHash: log.transactionHash!,
            logIndex: Number(log.logIndex),
            timestamp: Number((await getBlockTs(log.blockNumber!))),
            eventName: parsed.name,
            sender: (parsed.args.sender as string ?? null)?.toLowerCase?.() ?? null,
            owner: (parsed.args.owner as string ?? null)?.toLowerCase?.() ?? null,
            recipient: (parsed.args.recipient as string ?? null)?.toLowerCase?.() ?? null,
            tickLower: parsed.args.tickLower as number ?? null,
            tickUpper: parsed.args.tickUpper as number ?? null,
            amount: parsed.args.amount ? String(parsed.args.amount) : null,
            amount0: parsed.args.amount0 ? String(parsed.args.amount0) : null,
            amount1: parsed.args.amount1 ? String(parsed.args.amount1) : null,
            sqrtPriceX96: parsed.args.sqrtPriceX96 ? String(parsed.args.sqrtPriceX96) : null,
            liquidity: parsed.args.liquidity ? String(parsed.args.liquidity) : null,
            tick: parsed.args.tick as number ?? null,
          }
        });
        totalEvents++;
      } catch (error) {
        console.error(`[INGEST] Failed to upsert event ${id}:`, error);
      }
    }
  }
  
  console.log(`[INGEST] Completed ingestion for pool ${address}. Total events: ${totalEvents}`);
  return totalEvents;
}

const blockTsCache = new Map<bigint, bigint>();
async function getBlockTs(blockNumber: bigint) {
  if (blockTsCache.has(blockNumber)) return blockTsCache.get(blockNumber)!;
  const b = await flare.getBlock({ blockNumber });
  blockTsCache.set(blockNumber, BigInt(b.timestamp));
  return BigInt(b.timestamp);
}
