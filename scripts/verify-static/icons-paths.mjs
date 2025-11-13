#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MEDIA_TOKENS_DIR = path.join(ROOT, 'public', 'media', 'tokens');
const LEGACY_ICONS_DIR = path.join(ROOT, 'public', 'icons');
const REQUIRED_SYMBOLS = ['flr', 'usd0', 'usdce', 'fxrp', 'joule'];

async function listFiles(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

function findMatch(files, symbol) {
  const prefix = symbol.toLowerCase();
  return files.find((file) => file.toLowerCase().startsWith(prefix)) ?? null;
}

async function main() {
  const mediaFiles = await listFiles(MEDIA_TOKENS_DIR);
  const legacyFiles = await listFiles(LEGACY_ICONS_DIR);

  const report = REQUIRED_SYMBOLS.map((symbol) => ({
    symbol,
    media: findMatch(mediaFiles, symbol),
    legacy: findMatch(legacyFiles, symbol),
  }));

  const missingSymbols = report.filter((entry) => !entry.media && !entry.legacy).map((entry) => entry.symbol);
  const ok = mediaFiles.length > 0 || legacyFiles.length > 0;

  console.log(
    JSON.stringify(
      {
        ok,
        hasMediaTokens: mediaFiles.length > 0,
        hasLegacyIcons: legacyFiles.length > 0,
        report,
        missingSymbols,
      },
      null,
      2,
    ),
  );

  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message ?? String(error) }));
  process.exit(1);
});
