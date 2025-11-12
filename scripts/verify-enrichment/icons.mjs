#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRECTORIES = ['src', 'pages', 'app'];
const DISALLOWED_PATTERN = /(["'`])\/(?!media)icons\//g;

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
        if (line.includes('/icons/')) {
          DISALLOWED_PATTERN.lastIndex = 0;
          if (DISALLOWED_PATTERN.test(line)) {
            collectors.push({
              file: relative,
              line: index + 1,
              snippet: line.trim(),
            });
          }
        }
      });
    }
  }
}

async function main() {
  const matches = [];
  for (const dir of SCAN_DIRECTORIES) {
    if (await pathExists(dir)) {
      await readDirRecursive(path.join(ROOT, dir), matches);
    }
  }

  const ok = matches.length === 0;
  console.log(JSON.stringify({ ok, matches }, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message ?? String(error) }));
  process.exit(1);
});
