import { type PoolEventRow } from '../dbWriter';
import { type PoolEventName } from '../abis/pool';

interface MapArgs {
  eventName: PoolEventName;
  decodedArgs: Record<string, unknown>;
  blockNumber: number;
  logIndex: number;
  txHash: string;
  pool: string;
  timestamp: number;
}

function toStringBigInt(value: unknown): string | null {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return Math.trunc(value).toString();
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return null;
}

export function mapPoolEvent(args: MapArgs): PoolEventRow {
  const base: PoolEventRow = {
    id: `${args.txHash}:${args.logIndex}`,
    pool: args.pool,
    blockNumber: args.blockNumber,
    txHash: args.txHash,
    logIndex: args.logIndex,
    timestamp: args.timestamp,
    eventName: args.eventName,
    sender: null,
    owner: null,
    recipient: null,
    tickLower: null,
    tickUpper: null,
    amount: null,
    amount0: null,
    amount1: null,
    sqrtPriceX96: null,
    liquidity: null,
    tick: null,
  };

  switch (args.eventName) {
    case 'Swap': {
      base.sender = (args.decodedArgs.sender as string | undefined)?.toLowerCase() ?? null;
      base.recipient =
        (args.decodedArgs.recipient as string | undefined)?.toLowerCase() ?? null;
      base.amount0 = toStringBigInt(args.decodedArgs.amount0);
      base.amount1 = toStringBigInt(args.decodedArgs.amount1);
      base.sqrtPriceX96 = toStringBigInt(args.decodedArgs.sqrtPriceX96);
      base.liquidity = toStringBigInt(args.decodedArgs.liquidity);
      base.tick = toNumber(args.decodedArgs.tick);
      break;
    }
    case 'Mint': {
      base.sender = (args.decodedArgs.sender as string | undefined)?.toLowerCase() ?? null;
      base.owner = (args.decodedArgs.owner as string | undefined)?.toLowerCase() ?? null;
      base.tickLower = toNumber(args.decodedArgs.tickLower);
      base.tickUpper = toNumber(args.decodedArgs.tickUpper);
      base.amount = toStringBigInt(args.decodedArgs.amount);
      base.amount0 = toStringBigInt(args.decodedArgs.amount0);
      base.amount1 = toStringBigInt(args.decodedArgs.amount1);
      break;
    }
    case 'Burn': {
      base.owner = (args.decodedArgs.owner as string | undefined)?.toLowerCase() ?? null;
      base.tickLower = toNumber(args.decodedArgs.tickLower);
      base.tickUpper = toNumber(args.decodedArgs.tickUpper);
      base.amount = toStringBigInt(args.decodedArgs.amount);
      base.amount0 = toStringBigInt(args.decodedArgs.amount0);
      base.amount1 = toStringBigInt(args.decodedArgs.amount1);
      break;
    }
    case 'Collect': {
      base.owner = (args.decodedArgs.owner as string | undefined)?.toLowerCase() ?? null;
      base.recipient =
        (args.decodedArgs.recipient as string | undefined)?.toLowerCase() ?? null;
      base.tickLower = toNumber(args.decodedArgs.tickLower);
      base.tickUpper = toNumber(args.decodedArgs.tickUpper);
      base.amount0 = toStringBigInt(args.decodedArgs.amount0);
      base.amount1 = toStringBigInt(args.decodedArgs.amount1);
      break;
    }
  }

  return base;
}


