import { UNISWAP_V3_POOL_ABI } from '@/abis/UniswapV3Pool';
import { decodeEventLog, Hex } from 'viem';

export function decodePoolLog(log: {
  data: string;
  topics: string[];
}) {
  try {
    const parsed = decodeEventLog({
      abi: UNISWAP_V3_POOL_ABI,
      data: log.data as Hex,
      topics: log.topics as [Hex, ...Hex[]],
    });
    return { name: parsed.eventName, args: parsed.args as Record<string, unknown> };
  } catch { 
    return null; 
  }
}
