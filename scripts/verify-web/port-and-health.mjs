#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function getStartScript(rootDir) {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkgRaw = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(pkgRaw);
  return pkg.scripts?.start ?? '';
}

function resolveHealthPath(rootDir) {
  const appCandidate = path.join(rootDir, 'app', 'api', 'health', 'route.ts');
  if (fs.existsSync(appCandidate)) {
    return { path: appCandidate, type: 'app' };
  }
  const pagesCandidate = path.join(rootDir, 'pages', 'api', 'health.ts');
  if (fs.existsSync(pagesCandidate)) {
    return { path: pagesCandidate, type: 'pages' };
  }
  return null;
}

function validateHealthFile(info) {
  if (!info) return false;
  const src = fs.readFileSync(info.path, 'utf8');
  if (info.type === 'app') {
    return /export\s+async\s+function\s+GET/i.test(src);
  }
  return /export\s+default\s+function/i.test(src);
}

function main() {
  const rootDir = process.cwd();
  const startScript = getStartScript(rootDir).trim();
  const startOk = startScript === 'next start -p $PORT -H 0.0.0.0';

  const healthInfo = resolveHealthPath(rootDir);
  const healthOk = validateHealthFile(healthInfo);

  const result = {
    startOk,
    healthOk,
    healthPath: healthInfo ? path.relative(rootDir, healthInfo.path) : null,
  };
  console.log(JSON.stringify(result));

  if (!startOk || !healthOk) {
    process.exit(1);
  }
}

main();
