const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const ANKR_URL = process.env.ANKR_URL;
const ANKR_API_KEY = process.env.ANKR_API_KEY;
const NFPM_ADDRESSES = [
  process.env.ENOSYS_NFPM,
  process.env.SPARKDEX_NFPM,
]
  .filter(Boolean)
  .map((address) => address!.toLowerCase());

type JsonRecord = Record<string, unknown>;

async function ankrRequest<T>(method: string, params: JsonRecord): Promise<T | null> {
  if (!ANKR_URL || !ANKR_API_KEY) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ankr-api-key': ANKR_API_KEY,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
    signal: controller.signal,
  };

  try {
    const response = await fetch(ANKR_URL, requestInit);
    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    if (payload && typeof payload === 'object' && 'result' in payload) {
      return (payload as { result: T }).result;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseTokenId(tokenId: unknown): bigint | null {
  if (typeof tokenId === 'number' && Number.isInteger(tokenId)) {
    return BigInt(tokenId);
  }
  if (typeof tokenId === 'string' && tokenId.length > 0) {
    try {
      return BigInt(tokenId);
    } catch {
      return null;
    }
  }
  return null;
}

export async function nftsByOwner(owner: string): Promise<bigint[]> {
  if (!ADDRESS_REGEX.test(owner) || NFPM_ADDRESSES.length === 0) {
    return [];
  }

  const nfpmSet = new Set(NFPM_ADDRESSES);
  const result = await ankrRequest<{
    assets?: Array<{ contractAddress?: string; tokenId?: string | number }>;
  }>('ankr_getNFTsByOwner', {
    blockchain: 'flare',
    walletAddress: owner,
    pageSize: 1000,
  });

  if (!result || !Array.isArray(result.assets)) {
    return [];
  }

  const ids: bigint[] = [];
  for (const asset of result.assets) {
    const contract = typeof asset.contractAddress === 'string' ? asset.contractAddress.toLowerCase() : null;
    if (!contract || !nfpmSet.has(contract)) continue;
    const parsed = parseTokenId(asset.tokenId);
    if (parsed !== null) {
      ids.push(parsed);
    }
  }

  return ids;
}

function extractPrice(candidate: unknown): number | null {
  if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  if (typeof candidate === 'string') {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function ankrTokenPrice(address: string): Promise<number | null> {
  if (!ADDRESS_REGEX.test(address)) return null;

  const result = await ankrRequest<JsonRecord>('ankr_getTokenPrice', {
    blockchain: 'flare',
    contractAddress: address,
  });

  if (!result) return null;

  const candidates: Array<unknown> = [
    result.USD,
    result.usd,
    result.price,
    result.priceUsd,
    result.priceUSD,
    result.tokenPrice,
    result.tokenPriceUsd,
    result.tokenPriceUSD,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && 'USD' in (candidate as JsonRecord)) {
      const price = extractPrice((candidate as JsonRecord).USD);
      if (price !== null) return price;
    }
    const parsed = extractPrice(candidate);
    if (parsed !== null) return parsed;
  }

  if (result.prices && typeof result.prices === 'object') {
    const map = result.prices as JsonRecord;
    for (const value of Object.values(map)) {
      const parsed = extractPrice(value);
      if (parsed !== null) return parsed;
    }
  }

  return null;
}
