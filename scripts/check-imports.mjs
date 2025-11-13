#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'out',
  'dist',
  'logs',
  '.husky',
]);
const VALID_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

const BLOCKLIST = [
  {
    regex: /from\s+['"](\.\.\/){1,}src\//,
    message: 'Do not import from ../src – use aliases.',
  },
  {
    regex: /from\s+['"](\.\.\/){2,}lib\//,
    message: 'Do not import from ../../lib – use @lib/* alias.',
  },
];

const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry) || entry.startsWith('node_modules')) continue;
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!VALID_EXTENSIONS.has(path.extname(entry))) continue;
    checkFile(fullPath);
  }
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    BLOCKLIST.forEach(({ regex, message }) => {
      if (regex.test(line)) {
        violations.push({
          file: path.relative(ROOT, filePath),
          line: index + 1,
          lineText: line.trim(),
          message,
        });
      }
    });
  });
}

walk(ROOT);

if (violations.length > 0) {
  console.error('[imports:check] Relative parent imports are not allowed:\n');
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} — ${violation.message}`);
    console.error(`  ${violation.lineText}`);
  }
  process.exit(1);
}

console.log('[imports:check] OK — no blocked import patterns found.');
