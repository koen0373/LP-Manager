import type { PositionRow } from '../types/positions';
import { getRflrRewardForPosition } from './rflrRewards';
import { getTokenPrice } from './tokenPrices';
import {
  getContractCreation,
  getNftTransfers,
  getContractSourceCode,
  type FlarescanTokenNftTx,
} from '../lib/adapters/flarescan';
import type { ExplorerLog } from '../lib/adapters/logs';
import { fetchLogsViaBlockscout } from '../lib/adapters/blockscout';
import { fetchLatestBlockNumber, fetchLogsViaRpc } from '../lib/adapters/rpcLogs';
import { timedFetch } from '../lib/util/timedFetch';
import { mapWithConcurrency } from '../lib/util/concurrency';
import { memoize, clearCache } from '../lib/util/memo';
import { withTimeout } from '../lib/util/withTimeout';
import {
  getFactoryAddress,
  getPoolAddress,
  getPoolState,
  decodePositionData,
  calcAmountsForPosition,
  isInRange,
  formatPrice,
  calculatePositionValue,
  normalizeAddress,
  toSignedInt24,
  computePriceRange,
  calculateAccruedFees,
} from '../utils/poolHelpers';

const FLARE_RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_URL || 'https://flare.flr.finance/ext/bc/C/rpc';
const ENOSYS_POSITION_MANAGER = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657';
const COLLECT_TOPIC =
  '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0';
const PM_INCREASE_TOPIC =
  '0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f';
const PM_DECREASE_TOPIC =
  '0x26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b4';
const PM_COLLECT_TOPIC =
  '0x4d8babf9b22e68d8f3c8653392a91073d3f3d246ad70593d8c8ed3fe381b3c96';

export type PositionManagerEvent = {
  type: 'increase' | 'decrease' | 'collect';
  blockNumber: number;
  txHash: string;
  logIndex: number;
  timestamp?: number;
  liquidity: bigint;
  amount0: bigint;
  amount1: bigint;
  recipient?: string;
};

const toTokenTopic = (tokenId: string): string =>
  `0x${BigInt(tokenId).toString(16).padStart(64, '0')}`;

function parseAmount(data: string, index: number): bigint {
  const slice = data.slice(index * 64, (index + 1) * 64);
  return slice ? BigInt(`0x${slice}`) : 0n;
}

function parseAddress(data: string): string {
  return `0x${data.slice(24, 64)}`.toLowerCase();
}

// Function selectors
const SELECTORS = {
  balanceOf: '0x70a08231',
  tokenOfOwnerByIndex: '0x2f745c59',
  positions: '0x99fbab88',
  symbol: '0x95d89b41',
  name: '0x06fdde03',
  decimals: '0x313ce567',
};

export async function getContractCreationDate(contractAddress: string): Promise<Date | null> {
  return memoize(`contract-creation-${contractAddress}`, async () => {
    try {
      // Try Blockscout REST API first
      const response = await withTimeout(
        timedFetch(
          `https://flare-explorer.flare.network/api/v2/smart-contracts/${contractAddress}`
        ),
        15000,
        `Contract creation fetch for ${contractAddress} timed out`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.creation_transaction_hash) {
          const txResponse = await withTimeout(
            timedFetch(
              `https://flare-explorer.flare.network/api/v2/transactions/${data.creation_transaction_hash}`
            ),
            15000,
            `Transaction fetch for ${data.creation_transaction_hash} timed out`
          );
          if (txResponse.ok) {
            const txData = await txResponse.json();
            return new Date(txData.timestamp);
          }
        }
      }
  } catch (error) {
    // Silently fall through to fallback (Blockscout might be rate limiting)
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Flarescan] Blockscout contract creation failed, falling back to Flarescan API:', error);
    }
  }

  // Fallback to Flarescan API (may also fail with 403)
  try {
    const creation = await getContractCreation(contractAddress);
    if (!creation?.txHash) {
      return null;
    }

    const receipt = (await callFlareScan('eth_getTransactionReceipt', [creation.txHash])) as {
      blockNumber?: string;
    } | null;

    if (!receipt?.blockNumber) {
      return null;
    }

    const block = (await callFlareScan('eth_getBlockByNumber', [receipt.blockNumber, false])) as {
      timestamp?: string;
    } | null;

    if (!block?.timestamp) {
      return null;
    }

    const timestampMs = Number.parseInt(block.timestamp, 16) * 1000;
    return new Date(timestampMs);
  } catch (error) {
    // Gracefully handle 403 or other API errors
    // This is non-critical - app works fine without contract creation dates
    if (process.env.NODE_ENV !== 'production') {
      console.error('[FLARESCAN] Error fetching contract creation date:', error);
    }
    return null;
  }
  }, 5 * 60 * 1000); // 5 minute cache
}

export async function getPositionTransferHistory(
  tokenId: string
): Promise<FlarescanTokenNftTx[]> {
  return getNftTransfers(ENOSYS_POSITION_MANAGER, tokenId);
}

// Token metadata cache
const tokenCache = new Map<string, { symbol: string; name: string; decimals: number }>();
const positionsCache = new Map<string, { expires: number; data: PositionRow[] }>();
const CACHE_TTL_MS = 30_000; // 30 seconds cache to avoid spamming the API

function getCachedPositions(address: `0x${string}`): PositionRow[] | null {
  const cached = positionsCache.get(address);
  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expires) {
    positionsCache.delete(address);
    return null;
  }

  return cached.data;
}

function setCachedPositions(address: `0x${string}`, data: PositionRow[]): void {
  positionsCache.set(address, {
    data,
    expires: Date.now() + CACHE_TTL_MS,
  });

  // Prevent unbounded growth
  if (positionsCache.size > 50) {
    const firstKey = positionsCache.keys().next().value;
    if (firstKey) {
      positionsCache.delete(firstKey);
    }
  }
}

// Helper function to call FlareScan API via local proxy with retry logic
async function callFlareScan(method: string, params: unknown[] = [], retries = 3): Promise<unknown> {
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < retries) {
    attempt += 1;
    try {
      const response = await withTimeout(
        timedFetch(FLARE_RPC_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method,
            params,
          }),
        }),
        15000,
        `RPC call ${method} timed out`
      );

      if (!response.ok) {
        throw new Error(`RPC ${method} failed with status ${response.status}`);
      }

      const payload = await response.json();
      if (payload.error) {
        throw new Error(payload.error.message);
      }

      return payload.result;
    } catch (error) {
      lastError = error;
      const waitTime = 2 ** attempt * 1000;
      console.warn(
        `[RPC] ${method} failed (attempt ${attempt}/${retries}). Retrying in ${waitTime}ms`,
        error
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw lastError ?? new Error(`[RPC] ${method} failed after ${retries} attempts`);
}

// Get token metadata
async function getTokenMetadata(address: string): Promise<{ symbol: string; name: string; decimals: number }> {
  const normalized = normalizeAddress(address);

  if (tokenCache.has(normalized)) {
    return tokenCache.get(normalized)!;
  }

  try {
    // Get symbol
    const symbolData = await callFlareScan('eth_call', [
      {
        to: normalized,
        data: SELECTORS.symbol,
      },
      'latest',
    ]);

    // Get name
    const nameData = await callFlareScan('eth_call', [
      {
        to: normalized,
        data: SELECTORS.name,
      },
      'latest',
    ]);

    // Get decimals
    const decimalsData = await callFlareScan('eth_call', [
      {
        to: normalized,
        data: SELECTORS.decimals,
      },
      'latest',
    ]);

    // Decode results
    const symbol = decodeString(symbolData as string);
    const name = decodeString(nameData as string);
    const decimals = parseInt(decimalsData as string, 16);

    const metadata = { symbol, name, decimals };
    tokenCache.set(normalized, metadata);
    return metadata;
  } catch (error) {
    console.error(`Failed to get token metadata for ${address}:`, error);
    return { symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 18 };
  }
}

// Decode hex string to readable string
function decodeString(hex: string): string {
  if (!hex || hex === '0x') return '';
  
  try {
    // Remove 0x prefix and convert to bytes
    const bytes = hex.slice(2);
    const result = [];
    
    for (let i = 0; i < bytes.length; i += 2) {
      const byte = parseInt(bytes.substr(i, 2), 16);
      if (byte === 0) break; // Stop at null terminator
      result.push(byte);
    }
    
    return String.fromCharCode(...result);
  } catch (error) {
    console.error('Failed to decode string:', error);
    return 'UNKNOWN';
  }
}

// Get wallet's LP positions with Viem fallback
export async function getWalletPositions(walletAddress: string, options?: { refresh?: boolean }): Promise<PositionRow[]> {
  const normalizedAddress = normalizeAddress(walletAddress);
  const cacheKey = `wallet-positions-${normalizedAddress}`;
  if (options?.refresh) {
    clearCache(cacheKey);
    clearCache(`viem-positions-${normalizedAddress}`);
  }

  return memoize(cacheKey, async () => {
    try {
      const cached = getCachedPositions(normalizedAddress);
      if (cached) {
        return cached;
      }

      console.log(`Fetching positions for wallet: ${normalizedAddress}`);

    // Try server-side viem endpoint first to avoid hitting FlareScan unnecessarily
    try {
      const response = await withTimeout(
        timedFetch(`/api/positions?address=${normalizedAddress}${options?.refresh ? '&refresh=1' : ''}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        }),
        15000,
        `Positions API call for ${normalizedAddress} timed out`
      );

      if (response.ok) {
        const positions = (await response.json()) as PositionRow[];
        setCachedPositions(normalizedAddress, positions);
        return positions;
      }

      const errorText = await response.text();
      console.warn(
        `Positions API response not OK (${response.status}). Falling back to Viem/FlareScan directly.`,
        errorText
      );
    } catch (apiError) {
      console.warn('Positions API call failed, falling back locally:', apiError);
    }

    // Final fallback executed locally so the UI remains functional even if the API route fails
    console.log('Falling back to FlareScan API...');
    const fallbackPositions = await getWalletPositionsViaFlareScan(normalizedAddress);
    setCachedPositions(normalizedAddress, fallbackPositions);
    return fallbackPositions;
  } catch (error) {
    console.error('Failed to fetch wallet positions:', error);
    return [];
  }
  }, 2 * 60 * 1000); // 2 minute cache for wallet positions
}

// FlareScan API implementation (fallback)
export async function getWalletPositionsViaFlareScan(walletAddress: string): Promise<PositionRow[]> {
  try {
    const normalised = normalizeAddress(walletAddress);
    const factory = await getFactoryAddress(ENOSYS_POSITION_MANAGER as `0x${string}`);
    // Get balance of NFTs (number of positions)
    const balanceData = await callFlareScan('eth_call', [
      {
        to: ENOSYS_POSITION_MANAGER,
        data: `${SELECTORS.balanceOf}${normalised.slice(2).padStart(64, '0')}`,
      },
      'latest',
    ]);

    const balance = parseInt(balanceData as string, 16);
    console.log(`Found ${balance} positions via FlareScan`);

    if (balance === 0) {
      return [];
    }

    const indices = Array.from({ length: balance }, (_, i) => i);
    const processed = await mapWithConcurrency(indices, 12, async (i) =>
      processPosition(normalised, i, factory)
    );

    return processed
      .map((entry) => entry.value)
      .filter((position): position is PositionRow => position !== null);
  } catch (error) {
    console.error('Failed to fetch wallet positions via FlareScan:', error);
    return [];
  }
}

// Helper function to process a single position
async function processPosition(walletAddress: `0x${string}`, index: number, factory: `0x${string}`): Promise<PositionRow | null> {
  try {
    // Get token ID at index i
    const tokenIdData = await callFlareScan('eth_call', [
      {
        to: ENOSYS_POSITION_MANAGER,
        data: `${SELECTORS.tokenOfOwnerByIndex}${walletAddress.slice(2).padStart(64, '0')}${index.toString(16).padStart(64, '0')}`,
      },
      'latest',
    ]);

    const tokenId = parseInt(tokenIdData as string, 16);
    console.log(`Processing position ${tokenId}`);

    // Get position data
    const positionData = await callFlareScan('eth_call', [
      {
        to: ENOSYS_POSITION_MANAGER,
        data: `${SELECTORS.positions}${tokenId.toString(16).padStart(64, '0')}`,
      },
      'latest',
    ]);

    // Parse position data
    return await parsePositionData(tokenId, positionData as string, factory, walletAddress);
  } catch (error) {
    console.error(`Failed to process position ${index}:`, error);
    return null;
  }
}

// Parse position data using shared helpers
async function parsePositionData(tokenId: number, positionData: string, factory: `0x${string}`, walletAddress?: string): Promise<PositionRow | null> {
  try {
    console.log(`[DEBUG] Parsing position data for tokenId: ${tokenId}`);
    console.log(`[DEBUG] Position data length: ${positionData.length}`);
    
    // Use shared ABI decoding
    const decoded = decodePositionData(positionData);

    const token0 = normalizeAddress(decoded.token0);
    const token1 = normalizeAddress(decoded.token1);
    const fee = Number(decoded.fee);
    const tickLower = toSignedInt24(decoded.tickLower);
    const tickUpper = toSignedInt24(decoded.tickUpper);
    const liquidity = decoded.liquidity;
    const tokensOwed0 = decoded.tokensOwed0;
    const tokensOwed1 = decoded.tokensOwed1;
    
    console.log(`[DEBUG] Decoded position data:`);
    console.log(`[DEBUG] Token0: ${token0}, Token1: ${token1}`);
    console.log(`[DEBUG] Fee: ${fee}, TickLower: ${tickLower}, TickUpper: ${tickUpper}`);
    console.log(`[DEBUG] Liquidity: ${liquidity.toString()}`);
    
    // Normalize token addresses
    const [token0Meta, token1Meta] = await Promise.all([
      getTokenMetadata(token0),
      getTokenMetadata(token1),
    ]);
    console.log('[METADATA][flarescan]', {
      token0: token0Meta,
      token1: token1Meta,
    });
    
    const { lowerPrice, upperPrice } = computePriceRange(
      tickLower,
      tickUpper,
      token0Meta.decimals,
      token1Meta.decimals
    );
    
    const poolAddress = await getPoolAddress(factory, token0, token1, fee);
    
    // Get pool state
    const { sqrtPriceX96, tick: currentTick } = await getPoolState(poolAddress);
    
    // Calculate amounts using proper Uniswap V3 math
    const { amount0Wei, amount1Wei } = calcAmountsForPosition(
      liquidity,
      sqrtPriceX96,
      tickLower,
      tickUpper,
      token0Meta.decimals,
      token1Meta.decimals
    );
    
    const { fee0Wei, fee1Wei } = await calculateAccruedFees({
      poolAddress,
      liquidity,
      tickLower,
      tickUpper,
      currentTick,
      feeGrowthInside0LastX128: decoded.feeGrowthInside0LastX128,
      feeGrowthInside1LastX128: decoded.feeGrowthInside1LastX128,
      tokensOwed0,
      tokensOwed1,
    });
    
    // Check if in range
    const inRange = isInRange(currentTick, tickLower, tickUpper);
    
    // Calculate TVL and rewards
    const {
      amount0,
      amount1,
      fee0,
      fee1,
      price0Usd,
      price1Usd,
      tvlUsd,
      rewardsUsd,
    } = await calculatePositionValue({
      token0Symbol: token0Meta.symbol,
      token1Symbol: token1Meta.symbol,
      token0Decimals: token0Meta.decimals,
      token1Decimals: token1Meta.decimals,
      amount0Wei,
      amount1Wei,
      fee0Wei,
      fee1Wei,
      sqrtPriceX96,
    });
    
    console.log('[VALUE][flarescan]', {
      fee0Tokens: fee0,
      fee1Tokens: fee1,
      fee0Usd: fee0 * price0Usd,
      fee1Usd: fee1 * price1Usd,
    });

    const [rflrAmountRaw, rflrPriceUsd] = await Promise.all([
      getRflrRewardForPosition(tokenId.toString()),
      getTokenPrice('RFLR'),
    ]);

    const rflrAmount = rflrAmountRaw ?? 0;
    const rflrUsd = rflrAmount * rflrPriceUsd;
    
    // Unclaimed fees (for inactive pools, fees should be 0)
    const unclaimedFeesUsd = inRange ? rewardsUsd : 0;
    
    // Total rewards = unclaimed fees + RFLR (for active) or just RFLR (for inactive)
    const totalRewardsUsd = inRange ? (unclaimedFeesUsd + rflrUsd) : rflrUsd;

    // Create position row with real data
    return {
      id: tokenId.toString(),
      pairLabel: `${token0Meta.symbol} - ${token1Meta.symbol}`,
      feeTierBps: fee,
      tickLowerLabel: formatPrice(lowerPrice),
      tickUpperLabel: formatPrice(upperPrice),
      tvlUsd,
      rewardsUsd: totalRewardsUsd,
      unclaimedFeesUsd: unclaimedFeesUsd,
      rflrRewardsUsd: rflrUsd,
      rflrAmount,
      rflrUsd,
      rflrPriceUsd,
      // APS removed for Phase 3
      inRange,
      status: 'Active' as const,
      token0: {
        symbol: token0Meta.symbol,
        address: token0,
        name: token0Meta.name,
        decimals: token0Meta.decimals
      },
      token1: {
        symbol: token1Meta.symbol,
        address: token1,
        name: token1Meta.name,
        decimals: token1Meta.decimals
      },
      // New fields with real calculated values
      amount0,
      amount1,
      lowerPrice,
      upperPrice,
      tickLower,
      tickUpper,
      isInRange: inRange,
      poolAddress,
      price0Usd,
      price1Usd,
      fee0: 0, // TODO: Calculate individual fees
      fee1: 0, // TODO: Calculate individual fees
      walletAddress,
      currentTick,
    };
  } catch (error) {
    console.error('Failed to parse position data:', error);
    return null;
  }
}

// Function to get position NFT transfers for a specific token ID (Blockscout REST v2 API)
export async function getPositionNftTransfers(
  positionsAddress: string,
  tokenId: string,
  options?: { refresh?: boolean }
): Promise<
  Array<{
    from: string;
    to: string;
    timestamp: number;
    txHash: string;
    blockNumber: number;
  }>
> {
  const cacheKey = `nft-transfers-${positionsAddress}-${tokenId}`;
  if (options?.refresh) {
    clearCache(cacheKey);
  }

  return memoize(cacheKey, async () => {
    try {
      // Try Blockscout REST API first
      const response = await withTimeout(
        timedFetch(
          `https://flare-explorer.flare.network/api/v2/tokens/${positionsAddress}/instances/${tokenId}/transfers?page=1&page_size=100`
        ),
        15000,
        `NFT transfers fetch for token ${tokenId} timed out`
      );
    
    if (response.ok) {
      const data = await response.json();
      return data.items.map((transfer: {
        from: { hash: string };
        to: { hash: string };
        timestamp: string;
        transaction_hash: string;
        block_number: number;
        log_index: number;
      }) => ({
        from: transfer.from.hash,
        to: transfer.to.hash,
        timestamp: new Date(transfer.timestamp).getTime() / 1000,
        txHash: transfer.transaction_hash,
        blockNumber: transfer.block_number,
        logIndex: transfer.log_index,
      }));
    }
  } catch (error) {
    console.warn('[Flarescan] Blockscout NFT transfers failed, falling back to Flarescan API:', error);
  }

    // Fallback to Flarescan API
    const transfers = await getNftTransfers(positionsAddress, tokenId);
    return transfers.map((transfer) => ({
      from: transfer.from,
      to: transfer.to,
      timestamp: Number.parseInt(transfer.timeStamp, 10),
      txHash: transfer.hash,
      blockNumber: Number.parseInt(transfer.blockNumber, 10),
    }));
  }, 60_000);
}

export async function getPositionManagerEvents(
  tokenId: string,
  fromBlock: number,
  toBlock: number,
  options?: { refresh?: boolean }
): Promise<PositionManagerEvent[]> {
  const cacheKey = `pm-events-${tokenId}-${fromBlock}-${toBlock}`;
  if (options?.refresh) {
    clearCache(cacheKey);
  }

  return memoize(
    cacheKey,
    async () => {
  const tokenTopic = toTokenTopic(tokenId);
  const address = ENOSYS_POSITION_MANAGER.toLowerCase();

  const fetchLogs = async (topic: string) => {
    try {
      const logs = await fetchLogsViaBlockscout({
        address,
        fromBlock,
        toBlock,
        topics: [topic, tokenTopic],
      });
      return logs;
    } catch (blockscoutError) {
      console.warn(`[Flarescan] Blockscout logs failed for topic ${topic}, falling back to RPC:`, blockscoutError);
      try {
        const logs = await fetchLogsViaRpc({
          address,
          fromBlock,
          toBlock,
          topics: [topic, tokenTopic],
        });
        return logs;
      } catch (rpcError) {
        console.warn(`[Flarescan] RPC logs also failed for topic ${topic}:`, rpcError);
        return [];
      }
    }
  };

  const [increaseLogs, decreaseLogs, collectLogs] = await Promise.all([
    fetchLogs(PM_INCREASE_TOPIC),
    fetchLogs(PM_DECREASE_TOPIC),
    fetchLogs(PM_COLLECT_TOPIC),
  ]);

  const mapLogs = (
    logs: ExplorerLog[],
    type: PositionManagerEvent['type']
  ): PositionManagerEvent[] => {
    return logs.map((log) => {
      const dataHex = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
      const timestamp = log.timestamp ? Math.floor(new Date(log.timestamp).getTime() / 1000) : undefined;

      if (type === 'collect') {
        return {
          type,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          logIndex: log.logIndex ?? 0,
          timestamp,
          liquidity: 0n,
          amount0: parseAmount(dataHex, 1),
          amount1: parseAmount(dataHex, 2),
          recipient: parseAddress(dataHex.slice(0, 64)),
        };
      }

      return {
        type,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
        logIndex: log.logIndex ?? 0,
        timestamp,
        liquidity: parseAmount(dataHex, 0),
        amount0: parseAmount(dataHex, 1),
        amount1: parseAmount(dataHex, 2),
      };
    });
  };

  const increaseEvents = mapLogs(increaseLogs, 'increase');
  const decreaseEvents = mapLogs(decreaseLogs, 'decrease');
  const collectEvents = mapLogs(collectLogs, 'collect');

  return [...increaseEvents, ...decreaseEvents, ...collectEvents].sort(
    (a, b) =>
      a.blockNumber === b.blockNumber ? a.txHash.localeCompare(b.txHash) : a.blockNumber - b.blockNumber
  );
    },
    60_000
  );
}

// Function to get collect events for a specific position (Blockscout REST v2 API)
export async function getPositionCollects(
  poolAddress: string,
  positionsAddress: string,
  tokenId: string
): Promise<
  Array<{
    timestamp: number;
    amount0: number;
    amount1: number;
    txHash: string;
    blockNumber: number;
  }>
> {
  try {
    const transfers = await getPositionNftTransfers(positionsAddress, tokenId);
    const mintTransfer = transfers.find(
      (transfer) => transfer.from === '0x0000000000000000000000000000000000000000'
    );
    const fromBlock = mintTransfer?.blockNumber ?? 0;
    const toBlock = await fetchLatestBlockNumber();

    let logs = await fetchLogsViaBlockscout({
      address: poolAddress,
      fromBlock,
      toBlock,
      topics: [COLLECT_TOPIC],
    });

    if (logs.length === 0) {
      logs = await fetchLogsViaRpc({
        address: poolAddress,
        fromBlock,
        toBlock,
        topics: [COLLECT_TOPIC],
      });
    }

    return logs.map((log) => {
      const dataHex = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
      const amount0 = Number.parseInt(dataHex.slice(0, 64) || '0', 16);
      const amount1 = Number.parseInt(dataHex.slice(64, 128) || '0', 16);

      return {
        timestamp: log.timestamp ? Math.floor(new Date(log.timestamp).getTime() / 1000) : 0,
        amount0,
        amount1,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
    });
  } catch (error) {
    console.error('[FLARESCAN] Error fetching collect events:', error);
    return [];
  }
}

// Function to get contract code and ABI (simplified implementation)
export async function getContractCodeAbi(contractAddress: string): Promise<{
  sourceCode: string | null;
  abi: string | null;
  contractName: string | null;
}> {
  try {
    const sourceEntry = await getContractSourceCode(contractAddress);
    if (!sourceEntry) {
      return { sourceCode: null, abi: null, contractName: null };
    }

    return {
      sourceCode: sourceEntry.SourceCode || null,
      abi: sourceEntry.ABI || null,
      contractName: sourceEntry.ContractName || null,
    };
  } catch (error) {
    console.error('[FLARESCAN] Error fetching contract code:', error);
    return { sourceCode: null, abi: null, contractName: null };
  }
}
