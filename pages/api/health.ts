import type { NextApiRequest, NextApiResponse } from 'next';

import { dbHealthCheck } from '@/lib/db';
import { rpcHealth } from '@/lib/rpc';

type HealthResponse = {
  uptime: number;
  version: string;
  commit: string;
  checks: {
    db: { ok: boolean };
    rpc: { ok: boolean };
    queue?: { ok: boolean };
  };
  timestamp: string;
};

const startTime = Date.now();

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<HealthResponse | { error: string }>,
) {
  const checks = {
    db: { ok: false },
    rpc: { ok: false },
    queue: { ok: true }, // Stub for now
  };

  // Run checks in parallel with individual timeouts
  // DB check gets longer timeout (1000ms) for first connection
  const [dbOk, rpcOk] = await Promise.all([
    dbHealthCheck(1000).catch(() => false),
    rpcHealth(1200).catch(() => false),
  ]);

  checks.db.ok = dbOk;
  checks.rpc.ok = rpcOk;

  const allPassed = checks.db.ok && checks.rpc.ok && (checks.queue?.ok ?? true);

  const response: HealthResponse = {
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version || '0.1.3',
    commit: process.env.RAILWAY_GIT_COMMIT_SHA?.substring(0, 7) || process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'unknown',
    checks,
    timestamp: new Date().toISOString(),
  };

  if (!allPassed) {
    // Find failing checks
    const failing = Object.entries(checks)
      .filter(([_, check]) => !check.ok)
      .map(([key]) => key);

    return res.status(500).json({
      ...response,
      error: `Health checks failed: ${failing.join(', ')}`,
    } as HealthResponse & { error: string });
  }

  return res.status(200).json(response);
}
