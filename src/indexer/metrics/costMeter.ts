/**
 * ANKR Cost Meter
 * 
 * Tracks RPC method calls and estimates ANKR credit consumption.
 * Default mapping: 10M credits = $1 USD.
 */

export interface CostMeterOptions {
  creditPerUsd?: number; // default: 10_000_000
  weights?: Record<string, number>; // credits per method call
}

export interface CostSummary {
  totalCredits: number;
  usdEstimate: number;
  byMethod: Record<string, { count: number; credits: number }>;
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  eth_getLogs: 20,
  eth_blockNumber: 1,
  eth_getBlockByNumber: 10,
  eth_call: 10,
  eth_getCode: 5,
  eth_getBalance: 2,
};

export class CostMeter {
  private readonly creditPerUsd: number;
  private readonly weights: Record<string, number>;
  private counts: Map<string, number> = new Map();

  constructor(options: CostMeterOptions = {}) {
    this.creditPerUsd = options.creditPerUsd ?? 10_000_000;
    this.weights = { ...DEFAULT_WEIGHTS, ...(options.weights ?? {}) };
  }

  /**
   * Track a method call
   */
  track(method: string): void {
    const current = this.counts.get(method) ?? 0;
    this.counts.set(method, current + 1);
  }

  /**
   * Get cost summary
   */
  summary(): CostSummary {
    let totalCredits = 0;
    const byMethod: Record<string, { count: number; credits: number }> = {};

    for (const [method, count] of this.counts.entries()) {
      const weight = this.weights[method] ?? 1;
      const credits = count * weight;
      totalCredits += credits;
      byMethod[method] = { count, credits };
    }

    return {
      totalCredits,
      usdEstimate: totalCredits / this.creditPerUsd,
      byMethod,
    };
  }

  /**
   * Reset all counters
   */
  reset(): void {
    this.counts.clear();
  }
}

