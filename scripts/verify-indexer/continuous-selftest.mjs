#!/usr/bin/env node

import { runContinuous } from '../indexer/continuous.mjs';

try {
  await import('tsconfig-paths/register');
} catch {
  // optional helper
}

const intervalSec = Number(process.env.FOLLOW_INTERVAL_SEC ?? 1);
const maxLoops = Number(process.env.MAX_LOOPS ?? 1);

runContinuous({ intervalSec, maxLoops, quiet: true })
  .then((result) => {
    console.log(JSON.stringify({ ok: true, loops: result.loops }));
    process.exit(0);
  })
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error?.message ?? String(error) }));
    process.exit(1);
  });
