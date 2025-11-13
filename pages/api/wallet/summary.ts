import type { NextApiRequest, NextApiResponse } from 'next';

import { fetchCanonicalPositionData, buildRoleAwareData } from '@/pages/api/positions';
import type { PositionsResponse } from '@/lib/positions/types';
import { resolveRole } from '@/lib/entitlements/resolveRole';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const SUNSET_DATE = '2025-11-14';
const SUCCESSOR_LINK = '</api/positions>; rel="successor-version"';
const WARNING_HEADER = '299 - "Use /api/positions"';

let hasWarned = false;

function warnOnce() {
  if (!hasWarned) {
    hasWarned = true;
    console.warn('DEPRECATED_API_USED /api/wallet/summary');
  }
}

function invalidMethod(res: NextApiResponse<PositionsResponse>) {
  res.setHeader('Allow', 'GET');
  res.status(405).json({
    success: false,
    error: 'Method not allowed',
    placeholder: true,
  });
}

// TODO: Remove this wrapper after 2025-11-14 once all consumers use /api/positions
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PositionsResponse>,
) {
  if (req.method !== 'GET') {
    invalidMethod(res);
    return;
  }

  warnOnce();

  res.setHeader('Sunset', SUNSET_DATE);
  res.setHeader('Link', SUCCESSOR_LINK);
  res.setHeader('Deprecation', 'true');
  res.setHeader('Warning', WARNING_HEADER);
  res.setHeader('x-ll-deprecated', 'true');

  const roleResolution = resolveRole(req);
  const addressParam = typeof req.query.address === 'string' ? req.query.address : '';
  if (!ADDRESS_REGEX.test(addressParam)) {
    res.status(400).json({
      success: false,
      error: 'Invalid address',
      placeholder: true,
    });
    return;
  }

  const normalizedAddress = addressParam.toLowerCase() as `0x${string}`;
  const startedAt = Date.now();

  try {
    const canonicalResult = await fetchCanonicalPositionData({
      address: normalizedAddress,
      role: roleResolution.role,
    });
    const canonicalData = {
      ...canonicalResult,
      meta: {
        ...(canonicalResult.meta ?? {}),
        address: normalizedAddress,
        elapsedMs: Date.now() - startedAt,
        deprecation: true,
      },
    };

    res.status(200).json({
      success: true,
      data: buildRoleAwareData(canonicalData, roleResolution),
    });
  } catch (error) {
    console.error('[api/wallet/summary] failed', {
      address: normalizedAddress,
      msg: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Summary unavailable',
      placeholder: true,
    });
  }
}
