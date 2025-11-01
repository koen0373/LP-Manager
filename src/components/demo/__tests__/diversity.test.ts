import { generateSimulatedPools } from '@/lib/demo/generator';

describe('Simulated demo generator', () => {
  it('produces diverse pools with non-negative APR', () => {
    const { pools, diversity } = generateSimulatedPools({
      limit: 9,
      minTvl: 150,
      timestamp: new Date('2025-10-30T18:00:00Z'),
    });

    expect(pools).toHaveLength(9);
    expect(diversity.valid).toBe(true);

    const strategies = new Set(pools.map((pool) => pool.strategy));
    const statuses = new Set(pools.map((pool) => pool.status));
    const providers = new Set(pools.map((pool) => pool.providerSlug));

    expect(strategies.size).toBeGreaterThanOrEqual(3);
    expect(statuses.size).toBeGreaterThanOrEqual(3);
    expect(providers.size).toBeGreaterThanOrEqual(2);

    const blazeswapPools = pools.filter((pool) => pool.providerSlug === 'blazeswap');
    const flaroTagged = blazeswapPools.filter((pool) => pool.domain === 'flaro.org');

    expect(blazeswapPools.length).toBeLessThanOrEqual(3);
    expect(flaroTagged.length).toBeLessThanOrEqual(1);

    pools.forEach((pool) => {
      expect(pool.tvlUsd).toBeGreaterThan(0);
      expect(pool.apr24hPct).toBeGreaterThanOrEqual(0);
    });
  });
});
