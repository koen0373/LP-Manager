import type { NextApiRequest, NextApiResponse } from 'next';

type DeprecatedResponse = {
  ok: false;
  reason: 'deprecated';
  use: string;
};

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<DeprecatedResponse>
) {
  return res.status(410).json({
    ok: false,
    reason: 'deprecated',
    use: '/api/prices/current',
  });
}
