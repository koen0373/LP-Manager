import type { NextApiRequest, NextApiResponse } from 'next';
import { queryOrDegrade } from '@/lib/analytics/db';

type PoolRow = {
  state: string | null;
  tvl_usd: number | null;
  fees_24h: number | null;
  fees_7d: number | null;
  positions_count: number | null;
};

const POOL_SQL = `
WITH base AS (
  SELECT pool, state, tvl_usd
  FROM mv_pool_latest_state
  WHERE pool = $1
),
fees24h AS (
  SELECT pool, COALESCE(SUM(fees_usd_24h), 0) AS fees_24h
  FROM mv_pool_fees_24h
  WHERE pool = $1
  GROUP BY pool
),
fees7d AS (
  SELECT pool, COALESCE(SUM(fees_usd_7d), 0) AS fees_7d
  FROM mv_pool_fees_7d
  WHERE pool = $1
  GROUP BY pool
),
positions AS (
  SELECT pool, COUNT(DISTINCT tokenId)::bigint AS positions_count
  FROM mv_position_latest_event
  WHERE pool = $1
  GROUP BY pool
)
SELECT
  base.state,
  base.tvl_usd,
  fees24h.fees_24h,
  fees7d.fees_7d,
  positions.positions_count
FROM base
LEFT JOIN fees24h ON fees24h.pool = base.pool
LEFT JOIN fees7d ON fees7d.pool = base.pool
LEFT JOIN positions ON positions.pool = base.pool
LIMIT 1;
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Pool ID required' });
  }

  const ts = Date.now();
  const result = await queryOrDegrade<PoolRow>(POOL_SQL, [id.toLowerCase()], 60_000);

  if (!result.ok) {
    return res.status(200).json({
      ok: false,
      degrade: true,
      ts,
      pool: {},
    });
  }

  const row = result.rows?.[0];
  const poolPayload = {
    state: row?.state ?? 'unknown',
    tvl: Number(row?.tvl_usd ?? 0),
    fees24h: Number(row?.fees_24h ?? 0),
    fees7d: Number(row?.fees_7d ?? 0),
    positionsCount: Number(row?.positions_count ?? 0),
  };

  return res.status(200).json({
    ok: true,
    degrade: false,
    ts,
    pool: poolPayload,
  });
}
