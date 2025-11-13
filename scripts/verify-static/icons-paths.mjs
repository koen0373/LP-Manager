#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MEDIA_DIR = path.join(ROOT, 'public', 'media', 'tokens');
const ICONS_DIR = path.join(ROOT, 'public', 'icons');
const SAMPLE_SYMBOLS = ['flr', 'usd0', 'fxrp'];

async function dirExists(dirPath) {
  try {
    await fs.access(dirPath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

function findSampleFile(files, symbol) {
  const lower = symbol.toLowerCase();
  return (
    files.find((file) => file.toLowerCase().startsWith(lower)) ??
    null
  );
}

async function main() {
  const mediaExists = await dirExists(MEDIA_DIR);
  const iconsExists = await dirExists(ICONS_DIR);

  const mediaFiles = mediaExists ? await collectFiles(MEDIA_DIR) : [];
  const iconsFiles = iconsExists ? await collectFiles(ICONS_DIR) : [];

  const sampleFiles = SAMPLE_SYMBOLS.map((symbol) => ({
    symbol,
    media: findSampleFile(mediaFiles, symbol),
    icons: findSampleFile(iconsFiles, symbol),
  }));

  const ok = mediaFiles.length > 0 || iconsFiles.length > 0;
  const payload = {
    ok,
    hasMediaTokens: mediaFiles.length > 0,
    hasIcons: iconsFiles.length > 0,
    sampleFiles,
  };

  console.log(JSON.stringify(payload, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message ?? String(error) }));
  process.exit(1);
});
