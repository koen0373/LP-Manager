/**
 * Token Bucket Rate Limiter
 * 
 * Ensures RPC calls respect a maximum requests-per-second (RPS) limit.
 */

export interface RateLimiterOptions {
  rps: number; // requests per second
  burst?: number; // max tokens in bucket (default: rps * 2)
}

export class RateLimiter {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per millisecond
  private lastRefill: number;

  constructor(options: RateLimiterOptions) {
    const { rps, burst } = options;
    this.capacity = burst ?? rps * 2;
    this.tokens = this.capacity;
    this.refillRate = rps / 1000; // convert RPS to tokens per ms
    this.lastRefill = Date.now();
  }

  /**
   * Schedule a function to run when a token is available
   */
  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    return fn();
  }

  private async acquire(): Promise<void> {
    this.refill();

    while (this.tokens < 1) {
      const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
      await this.sleep(waitMs);
      this.refill();
    }

    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

