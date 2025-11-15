import type { NextApiRequest, NextApiResponse } from 'next';
import { queryOrDegrade } from '@/lib/analytics/db';

type SummaryRow = {
  tvl_total: number | null;
  pools_active: number | null;
  positions_active: number | null;
  fees_24h: number | null;
  fees_7d: number | null;
};

const SUMMARY_SQL = `
SELECT
  (SELECT COALESCE(SUM(tvl_usd),0) FROM mv_pool_latest_state) AS tvl_total,
  (SELECT COUNT(*) FROM mv_pool_latest_state WHERE tvl_usd > 0) AS pools_active,
  (SELECT COUNT(DISTINCT tokenId) FROM mv_position_latest_event) AS positions_active,
  (SELECT COALESCE(SUM(fees_usd_24h),0) FROM mv_pool_fees_24h) AS fees_24h,
  (SELECT COALESCE(SUM(fees_usd_7d),0) FROM mv_pool_fees_7d) AS fees_7d;
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ts = Date.now();
  const result = await queryOrDegrade<SummaryRow>(SUMMARY_SQL, [], 60_000);

  if (!result.ok || !result.rows?.length) {
    return res.status(200).json({
      ok: false,
      degrade: true,
      ts,
      data: {},
    });
  }

  const row = result.rows[0] ?? {
    tvl_total: 0,
    pools_active: 0,
    positions_active: 0,
    fees_24h: 0,
    fees_7d: 0,
  };

  return res.status(200).json({
    ok: true,
    degrade: false,
    ts,
    data: {
      tvlTotal: Number(row.tvl_total ?? 0),
      poolsActive: Number(row.pools_active ?? 0),
      positionsActive: Number(row.positions_active ?? 0),
      fees24h: Number(row.fees_24h ?? 0),
      fees7d: Number(row.fees_7d ?? 0),
    },
  });
}
