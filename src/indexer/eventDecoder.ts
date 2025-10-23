/**
 * Event Decoder
 * 
 * Decodes raw blockchain logs into normalized PositionEvent and PositionTransfer records
 */

import { decodeEventLog, type Log, type Hex } from 'viem';
import {
  TOPIC_TO_EVENT_TYPE,
  TRANSFER_ABI,
  INCREASE_LIQUIDITY_ABI,
  DECREASE_LIQUIDITY_ABI,
  COLLECT_ABI,
} from './abis';
import { PositionEventType } from '@prisma/client';

export interface DecodedTransfer {
  type: 'TRANSFER';
  tokenId: string;
  from: string;
  to: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
}

export interface DecodedPositionEvent {
  type: PositionEventType;
  tokenId: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  // Event-specific fields
  recipient?: string;
  amount0?: string;
  amount1?: string;
  liquidityDelta?: string;
}

export type DecodedEvent = DecodedTransfer | DecodedPositionEvent;

export class EventDecoder {
  /**
   * Decode a raw log into a normalized event
   */
  decode(log: Log): DecodedEvent | null {
    const topic0 = log.topics[0];
    if (!topic0) return null;

    const eventType = TOPIC_TO_EVENT_TYPE[topic0];
    if (!eventType) return null;

    try {
      switch (eventType) {
        case 'TRANSFER':
          return this.decodeTransfer(log);
        case 'INCREASE':
          return this.decodeIncreaseLiquidity(log);
        case 'DECREASE':
          return this.decodeDecreaseLiquidity(log);
        case 'COLLECT':
          return this.decodeCollect(log);
        default:
          return null;
      }
    } catch (error) {
      console.warn(`[DECODE] Failed to decode log at ${log.transactionHash}:${log.logIndex}:`, error);
      return null;
    }
  }

  private decodeTransfer(log: Log): DecodedTransfer {
    const decoded = decodeEventLog({
      abi: [TRANSFER_ABI],
      data: log.data,
      topics: log.topics as [Hex, ...Hex[]],
    });

    return {
      type: 'TRANSFER',
      tokenId: decoded.args.tokenId.toString(),
      from: decoded.args.from,
      to: decoded.args.to,
      blockNumber: Number(log.blockNumber),
      txHash: log.transactionHash!,
      logIndex: Number(log.logIndex),
    };
  }

  private decodeIncreaseLiquidity(log: Log): DecodedPositionEvent {
    const decoded = decodeEventLog({
      abi: [INCREASE_LIQUIDITY_ABI],
      data: log.data,
      topics: log.topics as [Hex, ...Hex[]],
    });

    return {
      type: PositionEventType.INCREASE,
      tokenId: decoded.args.tokenId.toString(),
      blockNumber: Number(log.blockNumber),
      txHash: log.transactionHash!,
      logIndex: Number(log.logIndex),
      liquidityDelta: decoded.args.liquidity.toString(),
      amount0: decoded.args.amount0.toString(),
      amount1: decoded.args.amount1.toString(),
    };
  }

  private decodeDecreaseLiquidity(log: Log): DecodedPositionEvent {
    const decoded = decodeEventLog({
      abi: [DECREASE_LIQUIDITY_ABI],
      data: log.data,
      topics: log.topics as [Hex, ...Hex[]],
    });

    return {
      type: PositionEventType.DECREASE,
      tokenId: decoded.args.tokenId.toString(),
      blockNumber: Number(log.blockNumber),
      txHash: log.transactionHash!,
      logIndex: Number(log.logIndex),
      liquidityDelta: decoded.args.liquidity.toString(),
      amount0: decoded.args.amount0.toString(),
      amount1: decoded.args.amount1.toString(),
    };
  }

  private decodeCollect(log: Log): DecodedPositionEvent {
    const decoded = decodeEventLog({
      abi: [COLLECT_ABI],
      data: log.data,
      topics: log.topics as [Hex, ...Hex[]],
    });

    return {
      type: PositionEventType.COLLECT,
      tokenId: decoded.args.tokenId.toString(),
      blockNumber: Number(log.blockNumber),
      txHash: log.transactionHash!,
      logIndex: Number(log.logIndex),
      recipient: decoded.args.recipient,
      amount0: decoded.args.amount0.toString(),
      amount1: decoded.args.amount1.toString(),
    };
  }

  /**
   * Batch decode multiple logs
   */
  decodeBatch(logs: Log[]): DecodedEvent[] {
    return logs.map((log) => this.decode(log)).filter((e): e is DecodedEvent => e !== null);
  }
}

