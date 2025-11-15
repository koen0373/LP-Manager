import type { NextApiRequest, NextApiResponse } from 'next';

type HealthResponse = {
  ok: true;
  ts: number;
};

type ErrorResponse = {
  ok: false;
  error: string;
};

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<HealthResponse | ErrorResponse>,
) {
  try {
    return res.status(200).json({ ok: true, ts: Date.now() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ ok: false, error: message });
  }
}
