/**
 * Flarescan API adapter for fetching Position Manager events
 * Uses Etherscan-compatible API for fast historical event fetching
 */

import { Hex } from 'viem';

const FLARESCAN_API = 'https://flarescan.com/api';
const API_KEY = process.env.FLARESCAN_API_KEY || ''; // Optional for now

// Position Manager contract address
const POSITION_MANAGER = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657';

// Event signatures (topic0)
const INCREASE_LIQUIDITY_TOPIC = '0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f';
const DECREASE_LIQUIDITY_TOPIC = '0x26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b4';
const COLLECT_TOPIC = '0x40d0efd1a53d60ecbf40971b9daf7dc90178c3aadc7aab1765632738fa8b8f01';

// Flarescan API response type (Etherscan-compatible)
export interface FlarescanLogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string; // Decimal string
  timeStamp: string; // Hex string
  gasPrice: string;
  gasUsed: string;
  logIndex: string; // Decimal string
  transactionHash: string;
  transactionIndex: string;
}

// Normalized log format (compatible with viem)
export interface NormalizedLog {
  address: Hex;
  topics: [Hex, ...Hex[]];
  data: Hex;
  blockNumber: bigint;
  timestamp: number;
  logIndex: number;
  transactionHash: Hex;
}

/**
 * Convert tokenId (number) to topic (padded hex)
 */
function tokenIdToTopic(tokenId: string | number): string {
  const id = typeof tokenId === 'string' ? parseInt(tokenId, 10) : tokenId;
  return '0x' + id.toString(16).padStart(64, '0');
}

/**
 * Normalize Flarescan log to viem-compatible format
 */
function normalizeFlarescanLog(log: FlarescanLogEntry): NormalizedLog {
  return {
    address: log.address as Hex,
    topics: log.topics as [Hex, ...Hex[]],
    data: log.data as Hex,
    blockNumber: BigInt(log.blockNumber),
    timestamp: parseInt(log.timeStamp, 16), // Hex timestamp to decimal
    logIndex: parseInt(log.logIndex, 10),
    transactionHash: log.transactionHash as Hex,
  };
}

/**
 * Fetch logs for a specific event type and tokenId
 */
async function fetchEventsByTopic(
  topic0: string,
  topic1: string,
  fromBlock: number,
  toBlock: number | 'latest' = 'latest'
): Promise<NormalizedLog[]> {
  const url = new URL(FLARESCAN_API);
  url.searchParams.set('module', 'logs');
  url.searchParams.set('action', 'getLogs');
  url.searchParams.set('address', POSITION_MANAGER);
  url.searchParams.set('topic0', topic0);
  url.searchParams.set('topic1', topic1);
  url.searchParams.set('fromBlock', fromBlock.toString());
  url.searchParams.set('toBlock', toBlock === 'latest' ? 'latest' : toBlock.toString());
  
  if (API_KEY) {
    url.searchParams.set('apikey', API_KEY);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'LiquiLP/1.0',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `[FlarescanLogs] Failed to fetch events: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (data.status !== '1') {
    // Status 0 means no results (not an error)
    if (data.message === 'No records found') {
      return [];
    }
    throw new Error(`[FlarescanLogs] API error: ${data.message || 'Unknown error'}`);
  }

  if (!Array.isArray(data.result)) {
    return [];
  }

  return data.result.map(normalizeFlarescanLog);
}

/**
 * Fetch all Position Manager events for a specific tokenId
 * Returns IncreaseLiquidity, DecreaseLiquidity, and Collect events
 */
export async function fetchPositionEventsViaFlarescan(
  tokenId: string | number,
  fromBlock: number,
  toBlock: number | 'latest' = 'latest'
): Promise<NormalizedLog[]> {
  const tokenTopic = tokenIdToTopic(tokenId);

  console.log(
    `[FlarescanLogs] Fetching events for token ${tokenId} from block ${fromBlock}...`
  );

  try {
    // Fetch all event types in parallel
    const [increaseEvents, decreaseEvents, collectEvents] = await Promise.all([
      fetchEventsByTopic(INCREASE_LIQUIDITY_TOPIC, tokenTopic, fromBlock, toBlock),
      fetchEventsByTopic(DECREASE_LIQUIDITY_TOPIC, tokenTopic, fromBlock, toBlock),
      fetchEventsByTopic(COLLECT_TOPIC, tokenTopic, fromBlock, toBlock),
    ]);

    const allEvents = [...increaseEvents, ...decreaseEvents, ...collectEvents];

    // Sort by block number, then log index
    allEvents.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return Number(a.blockNumber - b.blockNumber);
      }
      return a.logIndex - b.logIndex;
    });

    console.log(
      `[FlarescanLogs] Found ${allEvents.length} events ` +
        `(${increaseEvents.length} increase, ${decreaseEvents.length} decrease, ` +
        `${collectEvents.length} collect)`
    );

    return allEvents;
  } catch (error) {
    console.error('[FlarescanLogs] Error fetching events:', error);
    throw error;
  }
}

/**
 * Check if Flarescan API is available (for fallback logic)
 */
export async function isFlarescanAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${FLARESCAN_API}?module=logs&action=getLogs`, {
      method: 'HEAD',
      headers: { 'User-Agent': 'LiquiLP/1.0' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

