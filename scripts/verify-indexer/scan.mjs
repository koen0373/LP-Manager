#!/usr/bin/env node
/* eslint-disable no-console */
try {
  await import('tsconfig-paths/register');
} catch (error) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[verify-indexer] tsconfig-paths/register not found, continuing');
  }
}
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const VERIFY_BLOCKS = Number(process.env.VERIFY_BLOCKS || 25);
const root = process.cwd();
const idxCorePath = join(root, 'src/indexer/indexerCore.ts');
const hasCore = existsSync(idxCorePath);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const startScript = pkg.scripts?.start || '';
const startOk = startScript === 'next start -p $PORT -H 0.0.0.0';

const result = { ok: startOk && hasCore, hasCore, startOk, VERIFY_BLOCKS };
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
