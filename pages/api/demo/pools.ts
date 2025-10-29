import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchTokenIconBySymbol } from '@/services/tokenIconService';
import { pickDiverse, type DemoPool } from '@/lib/demoSelection';

const SAMPLE_POOLS: DemoPool[] = [
  // AGGRESSIVE STRATEGY POOLS (<12% range width) - 3 pools
  {
    providerSlug: "enosys",
    providerName: "Enosys v3",
    id: "22145",
    token0: "USDT0",
    token1: "WFLR",
    feeBps: 500,
    rangeMin: 0.0148,
    rangeMax: 0.0165,  // Range width: ~10.9% (aggressive)
    currentPrice: 0.0156,  // In range
    tvlUsd: 8450.30,
    unclaimedFeesUsd: 295.75,
    dailyFeesUsd: 21.12,
    dailyIncentivesUsd: 8.45,
    incentivesUsd: 9.2,
    incentivesTokenAmount: 1970,  // 2.0k rFLR
    status: "in"
  },
  {
    providerSlug: "blazeswap",
    providerName: "BlazeSwap v3",
    id: "41203",
    token0: "WFLR",
    token1: "SGB",
    feeBps: 1000,
    rangeMin: 0.00285,
    rangeMax: 0.00315,  // Range width: ~10.3% (aggressive)
    currentPrice: 0.003,  // In range
    tvlUsd: 4220.88,
    unclaimedFeesUsd: 168.83,
    dailyFeesUsd: 12.05,
    dailyIncentivesUsd: 5.18,
    incentivesUsd: 5.6,
    incentivesTokenAmount: 1200,  // 1.2k rFLR
    status: "in"
  },
  {
    providerSlug: "sparkdex",
    providerName: "SparkDEX v2",
    id: "DX-404",
    token0: "EXFI",
    token1: "USDT0",
    feeBps: 1000,
    rangeMin: 0.0465,
    rangeMax: 0.0515,  // Range width: ~10.2% (aggressive)
    currentPrice: 0.049,  // In range
    tvlUsd: 15780.45,
    unclaimedFeesUsd: 631.22,
    dailyFeesUsd: 45.07,
    dailyIncentivesUsd: 15.78,
    incentivesUsd: 17.1,
    incentivesTokenAmount: 3670,  // 3.7k rFLR
    status: "in"
  },
  
  // BALANCED & CONSERVATIVE POOLS - 6 pools
  {
    providerSlug: "sparkdex",
    providerName: "SparkDEX v2",
    id: "DX-118",
    token0: "SGB",
    token1: "CAND",
    feeBps: 30,
    rangeMin: 0.19,
    rangeMax: 0.23,  // Range width: ~19.0% (balanced)
    currentPrice: 0.21,  // In range
    tvlUsd: 445.22,
    unclaimedFeesUsd: 12.44,
    dailyFeesUsd: 0.89,
    dailyIncentivesUsd: 0.45,
    incentivesUsd: 0,
    status: "in"
  },
  {
    providerSlug: "enosys",
    providerName: "Enosys v3",
    id: "22109",
    token0: "FXRP",
    token1: "USDT0",
    feeBps: 100,
    rangeMin: 0.095,
    rangeMax: 0.125,  // Range width: ~27.3% (balanced)
    currentPrice: 0.099,  // Near band - onderste 3%
    tvlUsd: 623.50,
    unclaimedFeesUsd: 18.75,
    dailyFeesUsd: 1.34,
    dailyIncentivesUsd: 0.72,
    incentivesUsd: 0,
    status: "near"
  },
  {
    providerSlug: "blazeswap",
    providerName: "BlazeSwap v3",
    id: "41115",
    token0: "CAND",
    token1: "USDT0",
    feeBps: 300,
    rangeMin: 0.94,
    rangeMax: 1.06,  // Range width: ~12.0% (balanced - at threshold)
    currentPrice: 1.00,  // In range
    tvlUsd: 1245.80,
    unclaimedFeesUsd: 42.18,
    dailyFeesUsd: 3.01,
    dailyIncentivesUsd: 1.55,
    incentivesUsd: 0,
    status: "in"
  },
  {
    providerSlug: "sparkdex",
    providerName: "SparkDEX v2",
    id: "DX-221",
    token0: "EXFI",
    token1: "WFLR",
    feeBps: 30,
    rangeMin: 0.24,
    rangeMax: 0.31,  // Range width: ~25.5% (balanced)
    currentPrice: 0.275,  // In range
    tvlUsd: 2180.45,
    unclaimedFeesUsd: 65.41,
    dailyFeesUsd: 4.67,
    dailyIncentivesUsd: 2.35,
    incentivesUsd: 2.1,
    incentivesTokenAmount: 450,  // 450 rFLR
    status: "in"
  },
  {
    providerSlug: "blazeswap",
    providerName: "BlazeSwap v3",
    id: "41088",
    token0: "USDT0",
    token1: "WFLR",
    feeBps: 300,
    rangeMin: 0.0135,
    rangeMax: 0.0195,  // Range width: ~36.4% (conservative)
    currentPrice: 0.0165,  // In range
    tvlUsd: 6890.75,
    unclaimedFeesUsd: 275.63,
    dailyFeesUsd: 19.69,
    dailyIncentivesUsd: 7.84,
    incentivesUsd: 8.5,
    incentivesTokenAmount: 1825,  // 1.8k rFLR
    status: "in"
  },
  {
    providerSlug: "sparkdex",
    providerName: "SparkDEX v2",
    id: "DX-309",
    token0: "CAND",
    token1: "SGB",
    feeBps: 30,
    rangeMin: 0.30,
    rangeMax: 0.50,  // Range width: ~50% (conservative)
    currentPrice: 0.40,  // In range
    tvlUsd: 12450.30,
    unclaimedFeesUsd: 498.01,
    dailyFeesUsd: 35.57,
    dailyIncentivesUsd: 12.18,
    incentivesUsd: 12.4,
    incentivesTokenAmount: 2660,  // 2.7k rFLR
    status: "in"
  },
  {
    providerSlug: "enosys",
    providerName: "Enosys v3",
    id: "22067",
    token0: "WFLR",
    token1: "SGB",
    feeBps: 500,
    rangeMin: 0.0025,
    rangeMax: 0.0041,  // Range width: ~48.5% (conservative)
    currentPrice: 0.0043,  // Out of range - boven max
    tvlUsd: 3420.12,
    unclaimedFeesUsd: 136.80,
    dailyFeesUsd: 0.00,  // Out of range = no fees
    dailyIncentivesUsd: 0.00,
    incentivesUsd: 4.2,
    incentivesTokenAmount: 900,  // 900 rFLR (accumulated before going out)
    status: "out"
  },
  {
    providerSlug: "blazeswap",
    providerName: "BlazeSwap v3",
    id: "41051",
    token0: "WFLR",
    token1: "EXFI",
    feeBps: 300,
    rangeMin: 2.5,
    rangeMax: 3.5,  // Range width: ~33.3% (balanced)
    currentPrice: 3.0,  // In range
    tvlUsd: 187234.50,
    unclaimedFeesUsd: 2808.52,
    dailyFeesUsd: 200.61,
    dailyIncentivesUsd: 82.44,
    incentivesUsd: 85.2,
    incentivesTokenAmount: 18280,  // 18.3k rFLR
    status: "in"
  },
  {
    providerSlug: "enosys",
    providerName: "Enosys v3",
    id: "22203",
    token0: "SGB",
    token1: "USDT0",
    feeBps: 300,
    rangeMin: 0.0085,
    rangeMax: 0.0145,  // Range width: ~52.2% (conservative)
    currentPrice: 0.0115,  // In range
    tvlUsd: 28900.88,
    unclaimedFeesUsd: 867.03,
    dailyFeesUsd: 82.43,
    dailyIncentivesUsd: 28.90,
    incentivesUsd: 31.4,
    incentivesTokenAmount: 6730,  // 6.7k rFLR
    status: "in"
  },
  // Additional pools for better diversity
  {
    providerSlug: "enosys",
    providerName: "Enosys v3",
    id: "22301",
    token0: "WFLR",
    token1: "USDT0",
    feeBps: 500,
    rangeMin: 0.0155,
    rangeMax: 0.0175,  // Range width: ~12.1% (balanced - at threshold)
    currentPrice: 0.0153,  // Near band - onderste 3%
    tvlUsd: 5234.67,
    unclaimedFeesUsd: 145.88,
    dailyFeesUsd: 10.42,
    dailyIncentivesUsd: 4.18,
    incentivesUsd: 4.5,
    incentivesTokenAmount: 970,
    status: "near"
  },
  {
    providerSlug: "sparkdex",
    providerName: "SparkDEX v2",
    id: "DX-505",
    token0: "SGB",
    token1: "WFLR",
    feeBps: 100,
    rangeMin: 155,
    rangeMax: 185,  // Range width: ~17.6% (balanced)
    currentPrice: 192,  // Out of range - boven max
    tvlUsd: 8920.45,
    unclaimedFeesUsd: 312.67,
    dailyFeesUsd: 0.00,  // Out of range = no fees
    dailyIncentivesUsd: 0.00,
    incentivesUsd: 15.8,
    incentivesTokenAmount: 3390,  // Accumulated before going out
    status: "out"
  },
  {
    providerSlug: "blazeswap",
    providerName: "BlazeSwap v3",
    id: "41299",
    token0: "EXFI",
    token1: "SGB",
    feeBps: 500,
    rangeMin: 0.085,
    rangeMax: 0.095,  // Range width: ~11.1% (aggressive)
    currentPrice: 0.093,  // Near band - bovenste 3%
    tvlUsd: 3678.90,
    unclaimedFeesUsd: 98.34,
    dailyFeesUsd: 7.02,
    dailyIncentivesUsd: 2.94,
    incentivesUsd: 3.2,
    incentivesTokenAmount: 690,
    status: "near"
  },
];

export const config = {
  // Cache for 60s, stale-while-revalidate for 2min
  runtime: 'nodejs',
};

export default async function handler(_req: NextApiRequest, res: NextApiResponse<DemoPool[] | { error: string }>) {
  try {
    // Apply diversity selection
    const selected = pickDiverse(SAMPLE_POOLS, 9);
    
    // Fetch icons online for all tokens in parallel
    const rowsWithIcons = await Promise.all(
      selected.map(async (r) => {
        const jitter = (n: number) => Math.max(0, n + (Math.random() - 0.5) * (n * 0.02));
        
        // Fetch icons online
        const [token0Icon, token1Icon] = await Promise.all([
          fetchTokenIconBySymbol(r.token0),
          fetchTokenIconBySymbol(r.token1),
        ]);
        
        const baseDailyFee = r.dailyFeesUsd;
        const baseDailyIncentive = r.dailyIncentivesUsd;
        const jitteredDaily =
          r.status === 'out'
            ? 0
            : Math.round(jitter(baseDailyFee) * 100) / 100;
        const jitteredDailyIncentive =
          r.status === 'out'
            ? 0
            : Math.round(jitter(baseDailyIncentive) * 100) / 100;

        return {
          ...r,
          token0Icon,
          token1Icon,
          tvlUsd: Math.round(jitter(r.tvlUsd) * 100) / 100,
          unclaimedFeesUsd: Math.round(jitter(r.unclaimedFeesUsd) * 100) / 100,
          incentivesUsd: Math.round(jitter(r.incentivesUsd) * 100) / 100,
          dailyFeesUsd: jitteredDaily,
          dailyIncentivesUsd: jitteredDailyIncentive,
          incentivesTokenAmount: r.incentivesTokenAmount 
            ? Math.round(jitter(r.incentivesTokenAmount)) 
            : undefined,
        };
      })
    );
    
    // Set cache headers: 60s cache, 120s stale-while-revalidate
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json(rowsWithIcons);
  } catch (e) {
    console.error('[API demo/pools] Error:', e);
    res.status(500).json({ error: 'Failed to load demo pools' });
  }
}
