const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const RATE_LIMIT_INTERVAL_MS = 500; // 2 requests per second (free tier)
const MAX_RETRIES = 3;

let lastRequestAt = 0;

async function waitForRateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < RATE_LIMIT_INTERVAL_MS) {
    await delay(RATE_LIMIT_INTERVAL_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

export interface FetchOptions {
  request: () => Promise<Response>;
  description: string;
  retryStatusCodes?: number[];
}

/**
 * Wraps a fetch call with rate limiting (2 req/s) and retry/backoff behaviour.
 */
export async function rateLimitedFetch({
  request,
  description,
  retryStatusCodes = [429, 500, 502, 503, 504],
}: FetchOptions): Promise<Response> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < MAX_RETRIES) {
    attempt += 1;

    try {
      await waitForRateLimit();
      const response = await request();

      if (!retryStatusCodes.includes(response.status)) {
        return response;
      }

      const retryAfter = Number(response.headers.get('Retry-After')) || 2 ** attempt;
      console.warn(
        `[RATE_LIMIT] ${description} returned ${response.status}. Retrying in ${retryAfter}s (attempt ${attempt}/${MAX_RETRIES})`
      );
      await delay(retryAfter * 1000);
    } catch (error) {
      lastError = error;
      const wait = 2 ** attempt;
      console.warn(
        `[RATE_LIMIT] ${description} failed (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${wait}s`,
        error
      );
      await delay(wait * 1000);
    }
  }

  throw lastError ?? new Error(`[RATE_LIMIT] Unable to perform request for ${description}`);
}

export function toHex(blockNumber: number): `0x${string}` {
  return `0x${blockNumber.toString(16)}`;
}

