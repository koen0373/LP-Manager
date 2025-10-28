import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchTokenIconBySymbol } from '@/services/tokenIconService';

type DemoPoolRow = {
  providerSlug: string;
  providerName: string;
  id: string;
  token0: string;
  token1: string;
  token0Icon?: string | null;
  token1Icon?: string | null;
  feeBps: number;
  rangeMin: number;
  rangeMax: number;
  currentPrice?: number;  // Live market price
  tvlUsd: number;
  unclaimedFeesUsd: number;  // Total accumulated fees
  dailyFeesUsd?: number;     // Fees collected in last 24h
  incentivesUsd: number;
  status: 'in' | 'near' | 'out';
  apyPct?: number;
};

const SAMPLE_POOLS: DemoPoolRow[] = [
  // TVL $200-$700 (2 pools)
  {
    providerSlug: "sparkdex",
    providerName: "SparkDEX v2",
    id: "DX-118",
    token0: "SGB",
    token1: "CAND",
    feeBps: 30,
    rangeMin: 0.15,
    rangeMax: 0.28,
    currentPrice: 0.21,  // In range
    tvlUsd: 445.22,
    unclaimedFeesUsd: 12.44,  // Accumulated over ~14 days
    dailyFeesUsd: 0.89,       // Daily fee collection
    incentivesUsd: 0,
    status: "in",
    apyPct: 3.8
  },
  {
    providerSlug: "enosys",
    providerName: "Enosys v3",
    id: "22109",
    token0: "FXRP",
    token1: "USDT0",
    feeBps: 100,
    rangeMin: 0.08,
    rangeMax: 0.14,
    currentPrice: 0.085,  // Near band - onderste 3%
    tvlUsd: 623.50,
    unclaimedFeesUsd: 18.75,
    dailyFeesUsd: 1.34,
    incentivesUsd: 0,
    status: "near",
    apyPct: 5.2
  },
  // TVL $800-$2,400 (2 pools)
  {
    providerSlug: "blazeswap",
    providerName: "BlazeSwap v3",
    id: "41115",
    token0: "CAND",
    token1: "USDT0",
    feeBps: 300,
    rangeMin: 0.9,
    rangeMax: 1.1,
    currentPrice: 1.02,  // In range
    tvlUsd: 1245.80,
    unclaimedFeesUsd: 42.18,
    dailyFeesUsd: 3.01,
    incentivesUsd: 0,
    status: "in",
    apyPct: 6.1
  },
  {
    providerSlug: "sparkdex",
    providerName: "SparkDEX v2",
    id: "DX-221",
    token0: "EXFI",
    token1: "WFLR",
    feeBps: 30,
    rangeMin: 0.18,
    rangeMax: 0.35,
    currentPrice: 0.27,  // In range
    tvlUsd: 2180.45,
    unclaimedFeesUsd: 65.41,
    dailyFeesUsd: 4.67,
    incentivesUsd: 2.1,
    status: "in",
    apyPct: 4.5
  },
  // TVL $2,500-$8,000 (2 pools)
  {
    providerSlug: "enosys",
    providerName: "Enosys v3",
    id: "22067",
    token0: "WFLR",
    token1: "SGB",
    feeBps: 500,
    rangeMin: 0.002,
    rangeMax: 0.004,
    currentPrice: 0.00395,  // Near band - bovenste 3%
    tvlUsd: 3420.12,
    unclaimedFeesUsd: 136.80,
    dailyFeesUsd: 9.77,
    incentivesUsd: 0,
    status: "near",
    apyPct: 7.8
  },
  {
    providerSlug: "blazeswap",
    providerName: "BlazeSwap v3",
    id: "41088",
    token0: "USDT0",
    token1: "WFLR",
    feeBps: 300,
    rangeMin: 0.7,
    rangeMax: 1.4,
    currentPrice: 1.05,  // In range
    tvlUsd: 6890.75,
    unclaimedFeesUsd: 275.63,
    dailyFeesUsd: 19.69,
    incentivesUsd: 8.5,
    status: "in",
    apyPct: 9.2
  },
  // TVL $8,000-$35,000 (2 pools)
  {
    providerSlug: "sparkdex",
    providerName: "SparkDEX v2",
    id: "DX-309",
    token0: "CAND",
    token1: "SGB",
    feeBps: 30,
    rangeMin: 0.22,
    rangeMax: 0.58,
    currentPrice: 0.4,  // In range
    tvlUsd: 12450.30,
    unclaimedFeesUsd: 498.01,
    dailyFeesUsd: 35.57,
    incentivesUsd: 12.4,
    status: "in",
    apyPct: 8.5
  },
  {
    providerSlug: "enosys",
    providerName: "Enosys v3",
    id: "22045",
    token0: "EXFI",
    token1: "USDT0",
    feeBps: 300,
    rangeMin: 0.04,
    rangeMax: 0.12,
    currentPrice: 0.14,  // Out of range - boven max
    tvlUsd: 28900.88,
    unclaimedFeesUsd: 867.03,
    dailyFeesUsd: 0.00,  // Out of range = no fees collected
    incentivesUsd: 22.8,
    status: "out",
    apyPct: 11.3
  },
  // TVL >$150,000 (1 pool)
  {
    providerSlug: "blazeswap",
    providerName: "BlazeSwap v3",
    id: "41051",
    token0: "WFLR",
    token1: "EXFI",
    feeBps: 300,
    rangeMin: 2.1,
    rangeMax: 3.9,
    currentPrice: 3.05,  // In range
    tvlUsd: 187234.50,
    unclaimedFeesUsd: 2808.52,
    dailyFeesUsd: 200.61,
    incentivesUsd: 85.2,
    status: "in",
    apyPct: 14.2
  }
];

export default async function handler(_req: NextApiRequest, res: NextApiResponse<DemoPoolRow[] | { error: string }>) {
  try {
    // Randomize and select 9 rows from sample
    const shuffled = [...SAMPLE_POOLS].sort(() => Math.random() - 0.5);
    const count = 9;
    const selected = shuffled.slice(0, count);
    
    // Fetch icons online for all tokens in parallel
    const rowsWithIcons = await Promise.all(
      selected.map(async (r) => {
        const jitter = (n: number) => Math.max(0, n + (Math.random() - 0.5) * (n * 0.02));
        
        // Fetch icons online
        const [token0Icon, token1Icon] = await Promise.all([
          fetchTokenIconBySymbol(r.token0),
          fetchTokenIconBySymbol(r.token1),
        ]);
        
        return {
          ...r,
          token0Icon,
          token1Icon,
          tvlUsd: Math.round(jitter(r.tvlUsd) * 100) / 100,
          unclaimedFeesUsd: Math.round(jitter(r.unclaimedFeesUsd) * 100) / 100,
          incentivesUsd: Math.round(jitter(r.incentivesUsd) * 100) / 100,
          apyPct: typeof r.apyPct === 'number' ? Math.max(0, r.apyPct + (Math.random() - 0.5) * 0.5) : undefined,
        };
      })
    );
    
    res.status(200).json(rowsWithIcons);
  } catch (e) {
    console.error('[API demo/pools] Error:', e);
    res.status(500).json({ error: 'Failed to load demo pools' });
  }
}

