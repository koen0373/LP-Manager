import { db } from '@/store/prisma';

type PriceMap = { token0: number; token1: number }; // USD

export async function apyForWindow(
  pool: string, 
  fromTs: number, 
  toTs: number, 
  prices: PriceMap
) {
  // 1) Fees uit Collect
  const ev = await db.poolEvent.findMany({
    where: { 
      pool, 
      eventName: 'Collect', 
      timestamp: { gte: fromTs, lte: toTs }
    },
    select: { amount0: true, amount1: true }
  });
  
  const fees0 = ev.reduce((a, e) => a + Number(e.amount0 ?? 0), 0);
  const fees1 = ev.reduce((a, e) => a + Number(e.amount1 ?? 0), 0);
  const feesUsd = fees0 * prices.token0 + fees1 * prices.token1;

  // 2) TVL (v1 simplificatie: gemiddelde van snapshots begin/eind; later: echte TVL sampler)
  const tvlBegin = await approxTvlUSDAt(pool, fromTs, prices);
  const tvlEnd = await approxTvlUSDAt(pool, toTs, prices);
  const avgTvl = (tvlBegin + tvlEnd) / 2;

  const days = (toTs - fromTs) / 86400;
  const apr = avgTvl > 0 ? (feesUsd / avgTvl) * (365 / days) : 0;
  const apy = Math.pow(1 + apr/365, 365) - 1;
  
  return { feesUsd, avgTvl, apr, apy };
}

// TODO: approxTvlUSDAt → roep slot0 + liquidity op datum/benader met dichtstbijzijnde block
async function approxTvlUSDAt(_pool: string, _timestamp: number, _prices: PriceMap): Promise<number> {
  void _pool;
  void _timestamp;
  void _prices;
  // Voor nu een simpele benadering - later implementeren met echte TVL berekening
  // Dit zou moeten kijken naar de liquidity op dat moment en de prijzen
  return 1000; // Placeholder
}
