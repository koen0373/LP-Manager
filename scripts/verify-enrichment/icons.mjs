#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_DIRECTORIES = ['src', 'pages', 'app'];
const DISALLOWED_ABSOLUTE = /["'`]\/icons\//;
const DISALLOWED_MEDIA = /["'`]\/media\/icons\//;
const DISALLOWED_RELATIVE = /["'`]\.\/icons\//;

async function pathExists(relativePath) {
  try {
    await fs.access(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readDirRecursive(dir, collectors) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(ROOT, absolute);
    if (entry.isDirectory()) {
      if (relative.startsWith('node_modules') || relative.startsWith('.next')) {
        continue;
      }
      await readDirRecursive(absolute, collectors);
    } else if (entry.isFile()) {
      if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) continue;
      const content = await fs.readFile(absolute, 'utf8');
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (DISALLOWED_ABSOLUTE.test(line) || DISALLOWED_MEDIA.test(line) || DISALLOWED_RELATIVE.test(line)) {
          collectors.push({
            file: relative,
            line: index + 1,
            snippet: line.trim(),
            issue: 'Legacy /icons path detected (use /media/brand, /media/tokens, or /media/wallets via helpers)',
          });
        }
      });
    }
  }
}

async function loadAssetMap() {
  const assetMapPath = path.join(ROOT, 'config', 'assets.json');
  const raw = await fs.readFile(assetMapPath, 'utf8');
  return JSON.parse(raw);
}

function flattenAssets(map) {
  const entries = [];
  for (const [group, values] of Object.entries(map)) {
    for (const [name, relPath] of Object.entries(values)) {
      entries.push({ label: `${group}.${name}`, relPath });
    }
  }
  return entries;
}

async function validateAssetFiles(entries) {
  const missing = [];
  for (const entry of entries) {
    const diskPath = path.join(ROOT, 'public', entry.relPath.replace(/^\//, ''));
    try {
      await fs.access(diskPath);
    } catch {
      missing.push({ label: entry.label, path: entry.relPath });
    }
  }
  return missing;
}

async function main() {
  const matches = [];
  for (const dir of SOURCE_DIRECTORIES) {
    if (await pathExists(dir)) {
      await readDirRecursive(path.join(ROOT, dir), matches);
    }
  }

  const assetMap = await loadAssetMap();
  const assetEntries = flattenAssets(assetMap);
  const missingAssets = await validateAssetFiles(assetEntries);

  const ok = matches.length === 0 && missingAssets.length === 0;

  const result = {
    ok,
    legacyIconPaths: matches,
    missingAssets,
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message ?? String(error) }));
  process.exit(1);
});
