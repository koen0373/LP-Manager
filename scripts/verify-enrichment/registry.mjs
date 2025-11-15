#!/usr/bin/env node

try {
  await import('tsconfig-paths/register');
} catch {
  // optional in local dev
}

import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function loadRegistryModule() {
  const result = await build({
    entryPoints: ['src/lib/enrich/registry.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    target: 'node20',
    absWorkingDir: process.cwd(),
    logLevel: 'silent',
    packages: 'external',
  });

  const output = result.outputFiles[0];
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'll-enrich-'));
  const outfile = path.join(tmpDir, 'registry.mjs');

  await writeFile(outfile, output.text, 'utf8');
  const mod = await import(pathToFileURL(outfile).href);
  await rm(tmpDir, { recursive: true, force: true });
  return mod;
}

async function main() {
  const { detect } = await loadRegistryModule();
  const components = await detect();
  const missing = Object.entries(components)
    .filter(([, present]) => !present)
    .map(([key]) => key);
  const ok = missing.length === 0;

  console.log(JSON.stringify({ ok, components, missing }, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message ?? String(error) }));
  process.exit(1);
});
