import { describe, it, expect } from 'vitest';
import { encodeEventLog, decodeEventLog, type Hex } from 'viem';
import {
  POOL_SWAP_EVENT_ABI,
  POOL_MINT_EVENT_ABI,
  POOL_BURN_EVENT_ABI,
  POOL_COLLECT_EVENT_ABI,
} from '../abis/pool';
import { mapPoolEvent } from '../mappers/mapPoolEvent';

describe('Pool Event Decode', () => {
  it('should roundtrip Swap event', () => {
    const swapArgs = {
      sender: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
      amount0: BigInt(-1000000000000000000),
      amount1: BigInt(2000000000000000000),
      sqrtPriceX96: BigInt('79228162514264337593543950336'),
      liquidity: BigInt(1000000000000),
      tick: 100,
    };

    const encoded = encodeEventLog({
      abi: [POOL_SWAP_EVENT_ABI],
      eventName: 'Swap',
      args: swapArgs,
    });

    const decoded = decodeEventLog({
      abi: [POOL_SWAP_EVENT_ABI],
      topics: encoded.topics as Hex[],
      data: encoded.data,
      strict: true,
    });

    expect(decoded.eventName).toBe('Swap');
    expect(decoded.args.sender).toBe(swapArgs.sender);
    expect(decoded.args.recipient).toBe(swapArgs.recipient);
    expect(decoded.args.amount0).toBe(swapArgs.amount0);
    expect(decoded.args.amount1).toBe(swapArgs.amount1);
    expect(decoded.args.sqrtPriceX96).toBe(swapArgs.sqrtPriceX96);
    expect(decoded.args.liquidity).toBe(swapArgs.liquidity);
    expect(decoded.args.tick).toBe(swapArgs.tick);
  });

  it('should roundtrip Mint event', () => {
    const mintArgs = {
      sender: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
      tickLower: -100,
      tickUpper: 200,
      amount: BigInt(5000000000),
      amount0: BigInt(1000000000000000000),
      amount1: BigInt(2000000000000000000),
    };

    const encoded = encodeEventLog({
      abi: [POOL_MINT_EVENT_ABI],
      eventName: 'Mint',
      args: mintArgs,
    });

    const decoded = decodeEventLog({
      abi: [POOL_MINT_EVENT_ABI],
      topics: encoded.topics as Hex[],
      data: encoded.data,
      strict: true,
    });

    expect(decoded.eventName).toBe('Mint');
    expect(decoded.args.sender).toBe(mintArgs.sender);
    expect(decoded.args.owner).toBe(mintArgs.owner);
    expect(decoded.args.tickLower).toBe(mintArgs.tickLower);
    expect(decoded.args.tickUpper).toBe(mintArgs.tickUpper);
    expect(decoded.args.amount).toBe(mintArgs.amount);
    expect(decoded.args.amount0).toBe(mintArgs.amount0);
    expect(decoded.args.amount1).toBe(mintArgs.amount1);
  });

  it('should map Swap to PoolEventRow', () => {
    const decodedArgs = {
      sender: '0x1234567890123456789012345678901234567890',
      recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      amount0: BigInt(-1000000000000000000),
      amount1: BigInt(2000000000000000000),
      sqrtPriceX96: BigInt('79228162514264337593543950336'),
      liquidity: BigInt(1000000000000),
      tick: 100,
    };

    const row = mapPoolEvent({
      eventName: 'Swap',
      decodedArgs,
      blockNumber: 50000000,
      logIndex: 42,
      txHash: '0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
      pool: '0xpool1234pool1234pool1234pool1234pool1234',
      timestamp: 1699999999,
    });

    expect(row.eventName).toBe('Swap');
    expect(row.sender).toBe('0x1234567890123456789012345678901234567890');
    expect(row.recipient).toBe('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
    expect(row.amount0).toBe('-1000000000000000000');
    expect(row.amount1).toBe('2000000000000000000');
    expect(row.sqrtPriceX96).toBe('79228162514264337593543950336');
    expect(row.liquidity).toBe('1000000000000');
    expect(row.tick).toBe(100);
    expect(row.blockNumber).toBe(50000000);
    expect(row.logIndex).toBe(42);
  });

  it('should map Mint to PoolEventRow', () => {
    const decodedArgs = {
      sender: '0x1234567890123456789012345678901234567890',
      owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      tickLower: -100,
      tickUpper: 200,
      amount: BigInt(5000000000),
      amount0: BigInt(1000000000000000000),
      amount1: BigInt(2000000000000000000),
    };

    const row = mapPoolEvent({
      eventName: 'Mint',
      decodedArgs,
      blockNumber: 50000000,
      logIndex: 43,
      txHash: '0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
      pool: '0xpool1234pool1234pool1234pool1234pool1234',
      timestamp: 1699999999,
    });

    expect(row.eventName).toBe('Mint');
    expect(row.sender).toBe('0x1234567890123456789012345678901234567890');
    expect(row.owner).toBe('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
    expect(row.tickLower).toBe(-100);
    expect(row.tickUpper).toBe(200);
    expect(row.amount).toBe('5000000000');
    expect(row.amount0).toBe('1000000000000000000');
    expect(row.amount1).toBe('2000000000000000000');
  });

  it('should roundtrip Burn event', () => {
    const burnArgs = {
      owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
      tickLower: -100,
      tickUpper: 200,
      amount: BigInt(5000000000),
      amount0: BigInt(1000000000000000000),
      amount1: BigInt(2000000000000000000),
    };

    const encoded = encodeEventLog({
      abi: [POOL_BURN_EVENT_ABI],
      eventName: 'Burn',
      args: burnArgs,
    });

    const decoded = decodeEventLog({
      abi: [POOL_BURN_EVENT_ABI],
      topics: encoded.topics as Hex[],
      data: encoded.data,
      strict: true,
    });

    expect(decoded.eventName).toBe('Burn');
    expect(decoded.args.owner).toBe(burnArgs.owner);
    expect(decoded.args.tickLower).toBe(burnArgs.tickLower);
    expect(decoded.args.tickUpper).toBe(burnArgs.tickUpper);
  });

  it('should roundtrip Collect event', () => {
    const collectArgs = {
      owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
      recipient: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      tickLower: -100,
      tickUpper: 200,
      amount0: BigInt(1000000000),
      amount1: BigInt(2000000000),
    };

    const encoded = encodeEventLog({
      abi: [POOL_COLLECT_EVENT_ABI],
      eventName: 'Collect',
      args: collectArgs,
    });

    const decoded = decodeEventLog({
      abi: [POOL_COLLECT_EVENT_ABI],
      topics: encoded.topics as Hex[],
      data: encoded.data,
      strict: true,
    });

    expect(decoded.eventName).toBe('Collect');
    expect(decoded.args.owner).toBe(collectArgs.owner);
    expect(decoded.args.recipient).toBe(collectArgs.recipient);
    expect(decoded.args.amount0).toBe(collectArgs.amount0);
    expect(decoded.args.amount1).toBe(collectArgs.amount1);
  });
});


