import type { NextApiRequest, NextApiResponse } from 'next';

import {
  isBlazeSwapConfigured,
  positionsForWallet,
  type BlazeSwapV2Meta,
  type BlazeSwapV2Position,
} from '@/lib/providers/blazeswapV2';

type SuccessResponse = {
  ok: true;
  provider: 'blazeswap-v2';
  positions: BlazeSwapV2Position[];
  meta: BlazeSwapV2Meta;
};

type ErrorResponse = {
  ok: false;
  error: string;
};

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function parseMaxPairs(value: string | string[] | undefined): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const addressParam = typeof req.query.address === 'string' ? req.query.address : '';
  if (!ADDRESS_REGEX.test(addressParam)) {
    return res.status(400).json({ ok: false, error: 'invalid_address' });
  }

  if (!isBlazeSwapConfigured()) {
    return res
      .status(501)
      .json({ ok: false, error: 'blazeswap_not_configured' });
  }

  try {
    const maxPairs = parseMaxPairs(req.query.maxPairs);
    const { positions, meta } = await positionsForWallet(
      addressParam.toLowerCase() as `0x${string}`,
      maxPairs ? { maxPairs } : undefined,
    );

    return res.status(200).json({
      ok: true,
      provider: 'blazeswap-v2',
      positions,
      meta,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/blazeswap/positions] failed to load positions', {
      address: addressParam,
      msg: message,
    });
    return res.status(500).json({ ok: false, error: message });
  }
}
