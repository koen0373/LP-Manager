import { ankrTokenPrice } from '@/lib/providers/ankr';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const STABLE_ADDRESSES = new Map<string, number>([
  ['0xe7cd86e13ac4309349f30b3435a9d337750fc82d'.toLowerCase(), 1], // USDTe / USDT0
  ['0xfbda5f676cb37624f28265a144a48b0d6e87d3b6'.toLowerCase(), 1], // USDC.e
]);

const DEFILLAMA_ENDPOINT = 'https://coins.llama.fi/prices/current';

function normaliseAddresses(addresses: string[]): string[] {
  const seen = new Set<string>();
  const normalised: string[] = [];

  addresses.forEach((address) => {
    if (typeof address !== 'string') return;
    const lower = address.toLowerCase();
    if (!ADDRESS_REGEX.test(lower)) return;
    if (seen.has(lower)) return;
    seen.add(lower);
    normalised.push(lower);
  });

  return normalised;
}

async function fetchDefiLlamaPrices(addresses: string[]): Promise<Record<string, number>> {
  if (addresses.length === 0) return {};

  const query = addresses.map((addr) => `flare:${addr}`).join(',');
  const url = `${DEFILLAMA_ENDPOINT}?coins=${encodeURIComponent(query)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return {};
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== 'object' || !payload.coins) return {};

    const out: Record<string, number> = {};
    for (const address of addresses) {
      const entry = payload.coins[`flare:${address}`];
      const price = entry?.price;
      if (typeof price === 'number' && Number.isFinite(price)) {
        out[address] = price;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function getPrices(addresses: string[]): Promise<Record<string, number>> {
  const normalised = normaliseAddresses(addresses);
  if (normalised.length === 0) return {};

  const prices: Record<string, number> = {};

  normalised.forEach((address) => {
    if (STABLE_ADDRESSES.has(address)) {
      prices[address] = STABLE_ADDRESSES.get(address)!;
    }
  });

  const pending = normalised.filter((address) => prices[address] === undefined);

  for (const address of pending) {
    const price = await ankrTokenPrice(address);
    if (typeof price === 'number' && Number.isFinite(price)) {
      prices[address] = price;
    }
  }

  const fallbackTargets = normalised.filter((address) => prices[address] === undefined);
  if (fallbackTargets.length > 0) {
    const fallback = await fetchDefiLlamaPrices(fallbackTargets);
    for (const [address, price] of Object.entries(fallback)) {
      prices[address] = price;
    }
  }

  return prices;
}
